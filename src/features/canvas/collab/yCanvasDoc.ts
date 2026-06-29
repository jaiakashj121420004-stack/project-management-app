/**
 * yCanvasDoc.ts — the CRDT model for a collaborative canvas (Pro P3.7).
 *
 * One `Y.Doc` represents one canvas note. Its shape:
 *   - `elements` : Y.Array<Y.Map>  — one Y.Map per CanvasElement, holding that
 *                  element's flat fields (the same shape as the `scene` jsonb).
 *                  Concurrent edits to different elements / different fields
 *                  merge automatically; the array order is irrelevant (the scene
 *                  snapshot is sorted by the `z` field), so we never reorder it.
 *   - `text:<id>`: Y.XmlFragment   — one TOP-LEVEL fragment per TextBox, bound to
 *                  Tiptap via @tiptap/extension-collaboration so two people can
 *                  type in the same box and have their keystrokes merge. The
 *                  element's `body`/`text` fields are a *derived cache* (written
 *                  by whoever is editing, via RichTextBox.onUpdate) used for the
 *                  static (non-editing) render + previews + duplicate/paste.
 *   - `meta`     : Y.Map           — doc-level fields that aren't elements and
 *                  aren't on the undo stack (currently just `pageType`).
 *
 * IMPORTANT: large media bodies never enter the Y.Doc — an image/media element
 * stores only its storage `path` (or canonical `embedUrl`) + transform, exactly
 * as in the jsonb scene. The bytes live in Supabase Storage behind signed URLs.
 *
 * This module is pure (no React, no network). The hook (useYjsCanvas) drives it;
 * the provider (SupabaseYjsProvider) moves its updates over the wire.
 */
import * as Y from 'yjs';
import { getSchema } from '@tiptap/core';
import { prosemirrorJSONToYXmlFragment, yXmlFragmentToProsemirrorJSON } from '@tiptap/y-tiptap';
import type { PageType } from '@/lib/canvasPages';
import { textExtensions, emptyTextDoc, docToPlainText } from '../richText';
import {
  emptyScene,
  topZ,
  type CanvasElement,
  type CanvasScene,
  type TextBoxElement,
} from '../elements';

/** Top-level type names in the Y.Doc. */
const ELEMENTS_KEY = 'elements';
const META_KEY = 'meta';
const META_PAGE_TYPE = 'pageType';
/** Per-text-box fragment name, keyed by element id so it survives reorders. */
export function textFragmentName(elementId: string): string {
  return `text:${elementId}`;
}

/**
 * Transaction origins. The UndoManager only tracks LOCAL_ORIGIN, so element
 * edits (move/add/delete/z/lock/…) are undoable, while the derived text-body
 * cache (TEXT_SYNC_ORIGIN) and page-type changes (META_ORIGIN) are not — they
 * mirror the pre-CRDT design, where page type and rich-text typing each had
 * their own history separate from the element command stack.
 */
export const LOCAL_ORIGIN = Symbol('canvas-local');
export const TEXT_SYNC_ORIGIN = Symbol('canvas-text-sync');
export const META_ORIGIN = Symbol('canvas-meta');

/** The ProseMirror schema the canvas text fragments use (matches RichTextBox). */
const textSchema = getSchema(textExtensions);

// ── accessors ────────────────────────────────────────────────────────────────

export function getElementsArray(doc: Y.Doc): Y.Array<Y.Map<unknown>> {
  return doc.getArray<Y.Map<unknown>>(ELEMENTS_KEY);
}

export function getMeta(doc: Y.Doc): Y.Map<unknown> {
  return doc.getMap(META_KEY);
}

/** The (top-level) Y.XmlFragment that backs a TextBox's collaborative content. */
export function getTextFragment(doc: Y.Doc, elementId: string): Y.XmlFragment {
  return doc.getXmlFragment(textFragmentName(elementId));
}

export function getDocPageType(doc: Y.Doc, fallback: PageType): PageType {
  const value = getMeta(doc).get(META_PAGE_TYPE);
  return typeof value === 'string' ? (value as PageType) : fallback;
}

export function setDocPageType(doc: Y.Doc, pageType: PageType): void {
  Y.transact(doc, () => getMeta(doc).set(META_PAGE_TYPE, pageType), META_ORIGIN);
}

// ── element ⇄ Y.Map ──────────────────────────────────────────────────────────

/** Write every field of a plain element onto a (typically fresh) Y.Map. */
function writeElement(map: Y.Map<unknown>, element: CanvasElement): void {
  for (const [key, value] of Object.entries(element)) {
    map.set(key, value);
  }
}

/** A field whose value is structural (array/object) and compared by value. */
function isStructural(value: unknown): boolean {
  return typeof value === 'object' && value !== null;
}

/** Read a Y.Map back into a plain CanvasElement (its persisted shape). */
function readElement(map: Y.Map<unknown>): CanvasElement {
  return map.toJSON() as CanvasElement;
}

// ── seeding (scene jsonb → Y.Doc) ────────────────────────────────────────────

/**
 * Seed an EMPTY doc from the denormalised `scene` jsonb + page type. Used only
 * when a canvas has no persisted `doc_state` yet (its first realtime session) —
 * once `doc_state` exists the provider seeds from that instead, so this runs at
 * most once per canvas and never double-seeds an already-synced doc.
 *
 * Each TextBox's stored `body` JSON is converted into its Y.XmlFragment so the
 * collaborative editor opens with the existing content already in the CRDT.
 */
export function buildDocFromScene(doc: Y.Doc, scene: CanvasScene, pageType: PageType): void {
  Y.transact(
    doc,
    () => {
      getMeta(doc).set(META_PAGE_TYPE, pageType);
      const elements = getElementsArray(doc);
      for (const element of scene.elements) {
        const map = new Y.Map<unknown>();
        writeElement(map, element);
        elements.push([map]);
        if (element.type === 'text') seedTextFragment(doc, element);
      }
    },
    LOCAL_ORIGIN,
  );
}

/** Populate a TextBox's fragment from its `body` JSON (no-op if already filled). */
function seedTextFragment(doc: Y.Doc, element: TextBoxElement): void {
  const fragment = getTextFragment(doc, element.id);
  if (fragment.length > 0) return; // already seeded (e.g. from doc_state)
  const json = element.body ?? emptyTextDoc();
  prosemirrorJSONToYXmlFragment(textSchema, json, fragment);
}

// ── diff (scene → Y.Doc ops) ─────────────────────────────────────────────────

/**
 * Reconcile the doc's `elements` array against a freshly-computed scene from the
 * editor. The whole canvas editor is written in terms of "here is the new scene"
 * (commit), so this diff is what turns those whole-array commits into minimal
 * CRDT operations — additions, deletions, and per-field updates — inside ONE
 * undoable transaction. Because each change is scoped to the field/element that
 * actually moved, two users editing different elements never conflict.
 */
export function applySceneDiff(doc: Y.Doc, next: CanvasScene): void {
  const elements = getElementsArray(doc);
  const nextById = new Map(next.elements.map((el) => [el.id, el]));
  const seenIds = new Set<string>();

  Y.transact(
    doc,
    () => {
      // Update existing + delete removed. Walk backwards so index-based deletes
      // don't shift the elements we haven't visited yet.
      for (let i = elements.length - 1; i >= 0; i--) {
        const map = elements.get(i);
        const id = map.get('id') as string;
        const target = nextById.get(id);
        if (!target) {
          elements.delete(i, 1);
          continue;
        }
        seenIds.add(id);
        updateElementMap(map, target);
      }
      // Insert genuinely new elements.
      for (const element of next.elements) {
        if (seenIds.has(element.id)) continue;
        const map = new Y.Map<unknown>();
        writeElement(map, element);
        elements.push([map]);
        if (element.type === 'text') seedTextFragment(doc, element);
      }
    },
    LOCAL_ORIGIN,
  );
}

/** Apply only the changed fields of `element` onto its existing Y.Map. */
function updateElementMap(map: Y.Map<unknown>, element: CanvasElement): void {
  const entries = Object.entries(element) as Array<[string, unknown]>;
  for (const [key, value] of entries) {
    const current = map.get(key);
    if (isStructural(value) || isStructural(current)) {
      if (JSON.stringify(current) !== JSON.stringify(value)) map.set(key, value);
    } else if (current !== value) {
      map.set(key, value);
    }
  }
  // Remove keys that disappeared (e.g. a field cleared) — rare, but keeps the
  // map a faithful mirror of the element.
  for (const key of map.keys()) {
    if (!(key in element)) map.delete(key);
  }
}

/**
 * Write a TextBox's edited body + plain-text mirror into its element Y.Map. This
 * is the *cache* the static renderer + previews read; the fragment is the live
 * truth. Marked TEXT_SYNC_ORIGIN so it stays off the element undo stack (Tiptap
 * owns text undo while editing).
 */
export function syncTextBody(
  doc: Y.Doc,
  elementId: string,
  body: Record<string, unknown>,
  text: string,
): void {
  const elements = getElementsArray(doc);
  Y.transact(
    doc,
    () => {
      for (let i = 0; i < elements.length; i++) {
        const map = elements.get(i);
        if (map.get('id') === elementId) {
          map.set('body', body);
          map.set('text', text);
          return;
        }
      }
    },
    TEXT_SYNC_ORIGIN,
  );
}

// ── snapshot (Y.Doc → scene) ─────────────────────────────────────────────────

/**
 * Derive the plain `CanvasScene` the React editor renders from. Sorted by `z` so
 * render order is deterministic regardless of array order. Cheap: it's just
 * `map.toJSON()` per element (the text body cache is already on the map).
 */
export function docToScene(doc: Y.Doc): CanvasScene {
  const elements = getElementsArray(doc);
  if (elements.length === 0) return emptyScene();
  // Dedupe by element id (keep first). The array can briefly hold duplicate ids
  // if two clients both seed the very same never-synced canvas from `scene` at
  // the same instant; deduping here keeps the rendered scene correct (and React
  // keys unique) while the docs converge.
  const byId = new Map<string, CanvasElement>();
  for (let i = 0; i < elements.length; i++) {
    const element = readElement(elements.get(i));
    if (!byId.has(element.id)) byId.set(element.id, element);
  }
  return { elements: [...byId.values()].sort((a, b) => a.z - b.z) };
}

/** Convert a fragment's current content to Tiptap JSON (for the body cache). */
export function fragmentToBody(fragment: Y.XmlFragment): Record<string, unknown> {
  return yXmlFragmentToProsemirrorJSON(fragment) as Record<string, unknown>;
}

/** Flatten a fragment-derived body to plain text (mirror + empty check). */
export function bodyToText(body: Record<string, unknown>): string {
  return docToPlainText(body);
}

export { topZ };
