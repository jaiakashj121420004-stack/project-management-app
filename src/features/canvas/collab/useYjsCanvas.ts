/**
 * useYjsCanvas.ts — the React binding to a collaborative canvas Y.Doc (P3.7).
 *
 * This hook is a drop-in replacement for the old `useSceneHistory`: it exposes
 * the SAME surface the editor consumes — `{ scene, commit, undo, redo, canUndo,
 * canRedo }` — so the ~900-line CanvasEditor barely changes. Under the hood:
 *   - `scene` is derived from the Y.Doc on every change (local OR remote), so a
 *     peer's edit re-renders the stage automatically.
 *   - `commit(nextScene)` is diffed against the doc and applied as minimal CRDT
 *     ops in one undoable transaction (so the whole-scene editor stays intact).
 *   - undo/redo run a `Y.UndoManager` scoped to LOCAL edits only — it never
 *     clobbers a collaborator's concurrent work (the old snapshot stack would).
 *   - page type is now doc state too, so it syncs live.
 *   - a `SupabaseYjsProvider` carries updates + awareness over Realtime, gated to
 *     Pro members (the channel's RLS is the real gate).
 *
 * One hook instance per open canvas: CanvasEditorReady is keyed by note id, so
 * the doc / provider / awareness are created fresh per canvas and torn down on
 * switch — nothing leaks between notes.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Y from 'yjs';
import { Awareness } from 'y-protocols/awareness';
import { supabase } from '@/lib/supabase';
import type { PageType } from '@/lib/canvasPages';
import type { CanvasNote } from '@/types/database';
import { parseScene, type CanvasScene } from '../elements';
import {
  applySceneDiff,
  buildDocFromScene,
  docToScene,
  getDocPageType,
  getElementsArray,
  getTextFragment,
  setDocPageType,
  syncTextBody as syncTextBodyOp,
  LOCAL_ORIGIN,
} from './yCanvasDoc';
import { bytesToPgHex, pgHexToBytes } from './encoding';
import {
  readRemotePeers,
  CANVAS_USER_FIELD,
  CANVAS_CURSOR_FIELD,
  CANVAS_SELECTION_FIELD,
  type CanvasUser,
  type RemotePeer,
} from './awareness';
import { SupabaseYjsProvider, type ProviderStatus } from './SupabaseYjsProvider';

/** What CollaborationCaret needs: just an object exposing `.awareness`. */
export interface CaretProvider {
  awareness: Awareness;
}

export interface YjsCanvas {
  // ── history-compatible surface (mirrors useSceneHistory) ──
  scene: CanvasScene;
  commit: (next: CanvasScene) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  // ── page type (now collaborative doc state) ──
  pageType: PageType;
  setPageType: (pageType: PageType) => void;
  // ── persistence ──
  /** The full doc encoded as a Postgres bytea hex literal for `doc_state`. */
  encodeStateHex: () => string;
  // ── rich-text binding ──
  fragmentFor: (elementId: string) => Y.XmlFragment;
  syncTextBody: (elementId: string, body: Record<string, unknown>, text: string) => void;
  caretProvider: CaretProvider;
  // ── presence ──
  remotePeers: RemotePeer[];
  setLocalCursor: (world: { x: number; y: number } | null) => void;
  setLocalSelection: (ids: string[]) => void;
  connection: ProviderStatus;
}

interface UseYjsCanvasOptions {
  note: CanvasNote;
  /** Join the Realtime channel (Pro canvas + the user can access it). */
  realtimeEnabled: boolean;
  /** Identity for awareness; null while the profile is still loading. */
  me: CanvasUser | null;
}

/** Build + seed the Y.Doc once. doc_state (authoritative) wins; else the jsonb. */
function createSeededDoc(note: CanvasNote): Y.Doc {
  const doc = new Y.Doc();
  if (note.doc_state) {
    // Authoritative CRDT snapshot — fragments + elements come back intact.
    Y.applyUpdate(doc, pgHexToBytes(note.doc_state), 'seed');
  } else {
    // First realtime session for this canvas: lift the denormalised scene into
    // the CRDT (incl. seeding each TextBox fragment from its body).
    buildDocFromScene(doc, parseScene(note.scene), note.page_type);
  }
  return doc;
}

export function useYjsCanvas({ note, realtimeEnabled, me }: UseYjsCanvasOptions): YjsCanvas {
  // Created once per canvas (component is keyed by note id).
  const core = useState(() => {
    const doc = createSeededDoc(note);
    const awareness = new Awareness(doc);
    const undoManager = new Y.UndoManager(getElementsArray(doc), {
      trackedOrigins: new Set([LOCAL_ORIGIN]),
      captureTimeout: 0,
    });
    return { doc, awareness, undoManager };
  })[0];
  const { doc, awareness, undoManager } = core;

  const [scene, setScene] = useState<CanvasScene>(() => docToScene(doc));
  const [pageType, setPageTypeState] = useState<PageType>(() => getDocPageType(doc, note.page_type));
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [remotePeers, setRemotePeers] = useState<RemotePeer[]>([]);
  // Driven solely by the provider's status callback; the public value is derived
  // (so we never setState synchronously in the connect effect when realtime is off).
  const [providerStatus, setProviderStatus] = useState<ProviderStatus>('connecting');
  const connection: ProviderStatus = realtimeEnabled && me ? providerStatus : 'disconnected';

  // ── doc → React snapshot (coalesced) ──────────────────────────────────────
  const flushScheduled = useRef(false);
  useEffect(() => {
    const refresh = () => {
      flushScheduled.current = false;
      setScene(docToScene(doc));
      setPageTypeState(getDocPageType(doc, note.page_type));
    };
    const onUpdate = () => {
      if (flushScheduled.current) return;
      flushScheduled.current = true;
      queueMicrotask(refresh);
    };
    doc.on('update', onUpdate);
    return () => doc.off('update', onUpdate);
  }, [doc, note.page_type]);

  // ── undo/redo availability ────────────────────────────────────────────────
  useEffect(() => {
    const sync = () => {
      setCanUndo(undoManager.canUndo());
      setCanRedo(undoManager.canRedo());
    };
    undoManager.on('stack-item-added', sync);
    undoManager.on('stack-item-popped', sync);
    undoManager.on('stack-cleared', sync);
    sync();
    return () => {
      undoManager.off('stack-item-added', sync);
      undoManager.off('stack-item-popped', sync);
      undoManager.off('stack-cleared', sync);
    };
  }, [undoManager]);

  // ── awareness → remote peers ──────────────────────────────────────────────
  useEffect(() => {
    const localId = awareness.clientID;
    const onChange = (changes?: { added: number[]; updated: number[]; removed: number[] }) => {
      // Skip churn from our OWN cursor moves — only re-render when a *remote*
      // participant's presence actually changed.
      if (changes) {
        const touched = [...changes.added, ...changes.updated, ...changes.removed];
        if (touched.length > 0 && touched.every((id) => id === localId)) return;
      }
      setRemotePeers(readRemotePeers(awareness));
    };
    awareness.on('change', onChange);
    onChange();
    return () => awareness.off('change', onChange);
  }, [awareness]);

  // ── publish our identity ──────────────────────────────────────────────────
  useEffect(() => {
    if (!me) return;
    // Namespaced field (NOT `user`, which collaboration-caret owns on this same
    // awareness instance) → drives the canvas presence cursors/halos.
    awareness.setLocalStateField(CANVAS_USER_FIELD, me);
  }, [awareness, me]);

  // ── transport provider (Pro-gated; RLS is the real gate) ──────────────────
  useEffect(() => {
    if (!realtimeEnabled || !me) return;
    // Seed our presence before connecting so the first awareness broadcast has it.
    // Use per-field sets (NOT setLocalState, which would replace the whole state
    // and wipe the fields collaboration-caret manages on this awareness instance).
    awareness.setLocalStateField(CANVAS_USER_FIELD, me);
    awareness.setLocalStateField(CANVAS_CURSOR_FIELD, null);
    awareness.setLocalStateField(CANVAS_SELECTION_FIELD, []);
    const provider = new SupabaseYjsProvider({
      supabase,
      noteId: note.id,
      doc,
      awareness,
      onStatus: setProviderStatus,
    });
    void provider.connect();
    return () => provider.destroy();
    // me identity is refreshed by the effect above; only re-create on note/doc
    // identity or when realtime is toggled — not on every profile field change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc, awareness, note.id, realtimeEnabled, Boolean(me)]);

  // ── stable API ────────────────────────────────────────────────────────────
  const commit = useCallback((next: CanvasScene) => applySceneDiff(doc, next), [doc]);
  const undo = useCallback(() => undoManager.undo(), [undoManager]);
  const redo = useCallback(() => undoManager.redo(), [undoManager]);
  const setPageType = useCallback((pt: PageType) => setDocPageType(doc, pt), [doc]);
  const encodeStateHex = useCallback(() => bytesToPgHex(Y.encodeStateAsUpdate(doc)), [doc]);
  const fragmentFor = useCallback((id: string) => getTextFragment(doc, id), [doc]);
  const syncTextBody = useCallback(
    (id: string, body: Record<string, unknown>, text: string) => syncTextBodyOp(doc, id, body, text),
    [doc],
  );
  const setLocalCursor = useCallback(
    (world: { x: number; y: number } | null) =>
      awareness.setLocalStateField(CANVAS_CURSOR_FIELD, world),
    [awareness],
  );
  const setLocalSelection = useCallback(
    (ids: string[]) => awareness.setLocalStateField(CANVAS_SELECTION_FIELD, ids),
    [awareness],
  );
  const caretProvider = useMemo<CaretProvider>(() => ({ awareness }), [awareness]);

  // Tear the doc down on unmount (frees the CRDT + observers).
  useEffect(() => () => doc.destroy(), [doc]);

  return {
    scene,
    commit,
    undo,
    redo,
    canUndo,
    canRedo,
    pageType,
    setPageType,
    encodeStateHex,
    fragmentFor,
    syncTextBody,
    caretProvider,
    remotePeers,
    setLocalCursor,
    setLocalSelection,
    connection,
  };
}
