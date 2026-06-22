/**
 * elements.ts — the canvas element model (P3.1 foundation).
 *
 * A canvas document is an array of elements stored in `canvas_notes.scene` as
 * `{ elements: CanvasElement[] }`. Every element shares a transform box (x, y,
 * width, height, rotation), a stacking order (z), and a `locked` flag, then a
 * `type`-tagged body. Strokes / rich text / media BODIES arrive in P3.2–P3.5 —
 * their fields are declared now (so the persisted shape is stable) but only the
 * TextBox stub is actually created by the foundation toolbar.
 *
 * `scene` is jsonb (untrusted), so it is parsed + validated with Zod on read
 * (parseScene): unknown/garbage element entries are dropped rather than crashing
 * the editor. In P3.7 the same elements become Y.Map entries in a shared Y.Doc;
 * this plain-data shape is intentionally CRDT-friendly (flat fields, no methods).
 */
import { z } from 'zod';

/** Fields every element carries: a transform box + stacking + lock state. */
export interface CanvasElementBase {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Degrees, clockwise (Konva convention). */
  rotation: number;
  /** Stacking order; higher renders on top. */
  z: number;
  /** Locked elements can't be moved/resized/selected by normal drag (P3.6). */
  locked: boolean;
}

/** A pressure-sensitive freehand stroke (body filled in P3.2). */
export interface StrokeElement extends CanvasElementBase {
  type: 'stroke';
  /** Flattened input points [x, y, x, y, …] in the element's local space. */
  points: number[];
  color: string;
  size: number;
}

/** A rich-text box (Tiptap JSON body filled in P3.3). */
export interface TextBoxElement extends CanvasElementBase {
  type: 'text';
  /** Tiptap document JSON (P3.3); null for an empty placeholder. */
  body: Record<string, unknown> | null;
  /** Plain-text fallback rendered by the P3.1 stub + used for previews. */
  text: string;
}

/** An image element backed by a canvas-media storage path (P3.4). */
export interface ImageElement extends CanvasElementBase {
  type: 'image';
  /** Storage path in the canvas-media bucket; NEVER a data URL. Null = pending. */
  path: string | null;
  alt: string;
}

/** Audio/video — recorded/uploaded (storage path) or an allow-listed embed (P3.5). */
export interface MediaElement extends CanvasElementBase {
  type: 'media';
  kind: 'audio' | 'video';
  source: 'file' | 'embed';
  /** Storage path when source === 'file'. */
  path: string | null;
  /** Canonical embed URL when source === 'embed'. */
  embedUrl: string | null;
}

/** The discriminated union of everything that can live on a canvas. */
export type CanvasElement = StrokeElement | TextBoxElement | ImageElement | MediaElement;

/** A canvas element's `type` tag. */
export type CanvasElementType = CanvasElement['type'];

/** The persisted document body: just an ordered list of elements. */
export interface CanvasScene {
  elements: CanvasElement[];
}

// --- Zod schemas (defensive parsing of the untrusted jsonb scene) -----------

const baseSchema = {
  id: z.string().min(1),
  x: z.number().finite(),
  y: z.number().finite(),
  width: z.number().finite().nonnegative(),
  height: z.number().finite().nonnegative(),
  rotation: z.number().finite(),
  z: z.number().finite(),
  locked: z.boolean(),
};

const strokeSchema = z.object({
  ...baseSchema,
  type: z.literal('stroke'),
  points: z.array(z.number().finite()),
  color: z.string(),
  size: z.number().finite().positive(),
});

const textBoxSchema = z.object({
  ...baseSchema,
  type: z.literal('text'),
  body: z.record(z.string(), z.unknown()).nullable(),
  text: z.string(),
});

const imageSchema = z.object({
  ...baseSchema,
  type: z.literal('image'),
  path: z.string().nullable(),
  alt: z.string(),
});

const mediaSchema = z.object({
  ...baseSchema,
  type: z.literal('media'),
  kind: z.enum(['audio', 'video']),
  source: z.enum(['file', 'embed']),
  path: z.string().nullable(),
  embedUrl: z.string().nullable(),
});

const elementSchema: z.ZodType<CanvasElement> = z.discriminatedUnion('type', [
  strokeSchema,
  textBoxSchema,
  imageSchema,
  mediaSchema,
]);

/** An empty scene (what a fresh canvas and the `{}` default both resolve to). */
export function emptyScene(): CanvasScene {
  return { elements: [] };
}

/**
 * Parse the untrusted `canvas_notes.scene` jsonb into a typed CanvasScene.
 * Invalid individual elements are dropped (not fatal); a missing/garbage scene
 * resolves to an empty one. Elements are returned sorted by z so render order is
 * deterministic regardless of how they were stored.
 */
export function parseScene(raw: unknown): CanvasScene {
  if (!raw || typeof raw !== 'object') return emptyScene();
  const list = (raw as { elements?: unknown }).elements;
  if (!Array.isArray(list)) return emptyScene();

  const elements: CanvasElement[] = [];
  for (const entry of list) {
    const parsed = elementSchema.safeParse(entry);
    if (parsed.success) elements.push(parsed.data);
  }
  elements.sort((a, b) => a.z - b.z);
  return { elements };
}

/** The next z value to place a new element on top of everything else. */
export function topZ(elements: readonly CanvasElement[]): number {
  return elements.reduce((max, el) => Math.max(max, el.z), 0) + 1;
}

/**
 * A text-box placeholder dropped by the foundation toolbar's "Add" action. It is
 * a fully real, persisted element (selectable / movable / resizable / rotatable);
 * the rich-text body it shows is filled in P3.3. Centred on (cx, cy) in world
 * coordinates.
 */
export function createPlaceholderTextBox(
  cx: number,
  cy: number,
  z: number,
): TextBoxElement {
  const width = 220;
  const height = 120;
  return {
    id: crypto.randomUUID(),
    type: 'text',
    x: cx - width / 2,
    y: cy - height / 2,
    width,
    height,
    rotation: 0,
    z,
    locked: false,
    body: null,
    text: '',
  };
}
