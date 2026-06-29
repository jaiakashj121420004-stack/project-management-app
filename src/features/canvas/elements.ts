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

/** Compositing for a stroke: 'multiply' gives the highlighter its see-through,
 *  ink-layering look; everything else paints normally. */
export type StrokeBlend = 'normal' | 'multiply';

/**
 * A pressure-sensitive freehand stroke (P3.2). `points` are the raw input
 * SAMPLES — flattened `[x, y, pressure, x, y, pressure, …]` in the element's
 * local space — NOT the rendered outline. The filled outline is recomputed from
 * these samples with perfect-freehand at render time (freehand.ts), so a stroke
 * stays crisp at any zoom. `thinning`/`smoothing`/`simulatePressure` are the
 * perfect-freehand params; `opacity`/`blend` carry the pen-preset look. Every
 * field is persisted so a reloaded stroke renders identically to when drawn.
 */
export interface StrokeElement extends CanvasElementBase {
  type: 'stroke';
  /** Flattened input samples `[x, y, pressure, …]` in the element's local space. */
  points: number[];
  color: string;
  /** Base stroke width (perfect-freehand `size`), in world px. */
  size: number;
  /** Pressure→width influence (perfect-freehand `thinning`, −1..1). */
  thinning: number;
  /** Edge softening (perfect-freehand `smoothing`, 0..1). */
  smoothing: number;
  /** Stroke opacity (1 = opaque; the highlighter is translucent). */
  opacity: number;
  /** Compositing mode — 'multiply' for the highlighter. */
  blend: StrokeBlend;
  /** True when width was simulated from velocity (finger/mouse); false when it
   *  came from real stylus pressure (pen). Persisted so re-renders match input. */
  simulatePressure: boolean;
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

/**
 * A partial update to an element's mutable fields. Covers the shared transform
 * box, the stroke-only geometry a resize bakes in (scaling a stroke rewrites its
 * sample points + width), and the text-only rich-text body + its plain-text
 * mirror. The editor merges this onto the element; the `type` discriminant is
 * never touched.
 */
export type ElementPatch = Partial<CanvasElementBase> &
  Partial<Pick<StrokeElement, 'points' | 'size'>> &
  Partial<Pick<TextBoxElement, 'body' | 'text'>>;

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
  thinning: z.number().finite(),
  smoothing: z.number().finite(),
  opacity: z.number().finite().min(0).max(1),
  blend: z.enum(['normal', 'multiply']),
  simulatePressure: z.boolean(),
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
 * An image element placed on the canvas. The element is committed to the scene
 * once the upload is complete; `path` references the `canvas-media` Storage
 * object (never a data URL). Width/height come from the file's natural dimensions
 * (capped to a sensible max so it doesn't flood the canvas).
 */
export function createImageElement(
  x: number,
  y: number,
  z: number,
  path: string,
  width = 400,
  height = 300,
): ImageElement {
  return {
    id: crypto.randomUUID(),
    type: 'image',
    x,
    y,
    width,
    height,
    rotation: 0,
    z,
    locked: false,
    path,
    alt: '',
  };
}

/**
 * A media element backed by a recorded/uploaded canvas-media object (P3.5). The
 * element is committed once the upload completes; `path` references the storage
 * object (never a data URL). Centred on (cx, cy) in world coordinates.
 */
export function createMediaFileElement(
  cx: number,
  cy: number,
  z: number,
  kind: 'audio' | 'video',
  path: string,
  width: number,
  height: number,
): MediaElement {
  return {
    id: crypto.randomUUID(),
    type: 'media',
    x: cx - width / 2,
    y: cy - height / 2,
    width,
    height,
    rotation: 0,
    z,
    locked: false,
    kind,
    source: 'file',
    path,
    embedUrl: null,
  };
}

/**
 * A media element backed by an allow-listed embed (YouTube/Vimeo/Loom/
 * SoundCloud). `embedUrl` is the CANONICAL provider embed URL we built ourselves
 * (see embeds.ts) — never the raw pasted string. Centred on (cx, cy).
 */
export function createMediaEmbedElement(
  cx: number,
  cy: number,
  z: number,
  kind: 'audio' | 'video',
  embedUrl: string,
  width: number,
  height: number,
): MediaElement {
  return {
    id: crypto.randomUUID(),
    type: 'media',
    x: cx - width / 2,
    y: cy - height / 2,
    width,
    height,
    rotation: 0,
    z,
    locked: false,
    kind,
    source: 'embed',
    path: null,
    embedUrl,
  };
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
  return createTextBoxAt(cx - width / 2, cy - height / 2, z, { width, height });
}

/**
 * A text box anchored by its TOP-LEFT corner at (x, y) in world coordinates —
 * used by the click-to-place text tool so typing begins exactly where the user
 * clicked. Defaults to the same size as the toolbar placeholder.
 */
export function createTextBoxAt(
  x: number,
  y: number,
  z: number,
  opts?: { width?: number; height?: number },
): TextBoxElement {
  return {
    id: crypto.randomUUID(),
    type: 'text',
    x,
    y,
    width: opts?.width ?? 220,
    height: opts?.height ?? 120,
    rotation: 0,
    z,
    locked: false,
    body: null,
    text: '',
  };
}
