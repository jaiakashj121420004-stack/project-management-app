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

/** Fields every element carries: a transform box + stacking + lock + visibility. */
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
  /** Locked elements can't be moved/resized/selected by normal drag. */
  locked: boolean;
  /** Hidden elements aren't rendered but stay in the scene. Default true. */
  visible: boolean;
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

/** A named region — a labeled rounded rectangle drawn BEHIND content to group
 *  related elements. Purely visual + organisational; participates in selection,
 *  move, resize and the layers outline like any other element. */
export interface FrameElement extends CanvasElementBase {
  type: 'frame';
  /** The frame's title, shown as a chip at its top-left corner. */
  label: string;
  /** Accent colour (hex) for the border, translucent fill and label chip. */
  color: string;
}

/** The discriminated union of everything that can live on a canvas. */
export type CanvasElement =
  | StrokeElement
  | TextBoxElement
  | ImageElement
  | MediaElement
  | FrameElement;

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
  Partial<Pick<TextBoxElement, 'body' | 'text'>> &
  Partial<Pick<FrameElement, 'label' | 'color'>>;

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
  // Default true for backward compat — existing persisted elements without this
  // field parse as visible.
  visible: z.boolean().default(true),
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

const frameSchema = z.object({
  ...baseSchema,
  type: z.literal('frame'),
  label: z.string(),
  color: z.string(),
});

const elementSchema: z.ZodType<CanvasElement> = z.discriminatedUnion('type', [
  strokeSchema,
  textBoxSchema,
  imageSchema,
  mediaSchema,
  frameSchema,
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

/** The next z BELOW everything — so a new frame renders behind existing content. */
export function bottomZ(elements: readonly CanvasElement[]): number {
  return elements.reduce((min, el) => Math.min(min, el.z), 1) - 1;
}

/**
 * A named frame region centred on (cx, cy) in world coordinates. A fully real,
 * persisted element (selectable / movable / resizable / rotatable) that renders
 * behind content thanks to its low z. Mirrors the other create* factories.
 */
export function createFrame(cx: number, cy: number, z: number): FrameElement {
  const width = 480;
  const height = 320;
  return {
    id: crypto.randomUUID(),
    type: 'frame',
    x: cx - width / 2,
    y: cy - height / 2,
    width,
    height,
    rotation: 0,
    z,
    locked: false,
    visible: true,
    label: 'Frame',
    color: '#7A2A26',
  };
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
    visible: true,
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
    visible: true,
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
    visible: true,
    kind,
    source: 'embed',
    path: null,
    embedUrl,
  };
}

// ── Z-order helpers ──────────────────────────────────────────────────────────
// All helpers return a NEW elements array (immutable). After reordering, z
// values are re-numbered 1..N so they stay contiguous with no gaps or floats.

/** Re-number elements' z values 1..N to keep them contiguous after reordering. */
function reindexZ(elements: CanvasElement[]): CanvasElement[] {
  return elements.map((el, i) => ({ ...el, z: i + 1 }));
}

/**
 * Move the identified elements to the top of the stack (rendered last = on top).
 * All other elements stay in their relative order below.
 */
export function bringToFront(
  elements: CanvasElement[],
  ids: ReadonlySet<string>,
): CanvasElement[] {
  const sorted = [...elements].sort((a, b) => a.z - b.z);
  return reindexZ([...sorted.filter((el) => !ids.has(el.id)), ...sorted.filter((el) => ids.has(el.id))]);
}

/**
 * Move the identified elements to the bottom of the stack (rendered first =
 * behind everything else).
 */
export function sendToBack(
  elements: CanvasElement[],
  ids: ReadonlySet<string>,
): CanvasElement[] {
  const sorted = [...elements].sort((a, b) => a.z - b.z);
  return reindexZ([...sorted.filter((el) => ids.has(el.id)), ...sorted.filter((el) => !ids.has(el.id))]);
}

/**
 * Move each identified element one step higher in the stack (swap with the
 * immediately overlapping non-selected element). Processes from top to bottom
 * so a contiguous block of selected elements moves together.
 */
export function bringForward(
  elements: CanvasElement[],
  ids: ReadonlySet<string>,
): CanvasElement[] {
  const sorted = [...elements].sort((a, b) => a.z - b.z);
  // Walk from top–1 downward; swap selected with the unselected element above.
  for (let i = sorted.length - 2; i >= 0; i--) {
    if (ids.has(sorted[i]!.id) && !ids.has(sorted[i + 1]!.id)) {
      [sorted[i], sorted[i + 1]] = [sorted[i + 1]!, sorted[i]!];
    }
  }
  return reindexZ(sorted);
}

/**
 * Move each identified element one step lower in the stack (swap with the
 * immediately underlying non-selected element). Processes from bottom to top.
 */
export function sendBackward(
  elements: CanvasElement[],
  ids: ReadonlySet<string>,
): CanvasElement[] {
  const sorted = [...elements].sort((a, b) => a.z - b.z);
  // Walk from 1 upward; swap selected with the unselected element below.
  for (let i = 1; i < sorted.length; i++) {
    if (ids.has(sorted[i]!.id) && !ids.has(sorted[i - 1]!.id)) {
      [sorted[i], sorted[i - 1]] = [sorted[i - 1]!, sorted[i]!];
    }
  }
  return reindexZ(sorted);
}

/**
 * Duplicate the identified elements: each copy gets a new id, is offset by
 * `offset` world pixels (both axes), and is placed on top of everything else.
 * Returns the full elements array including the new copies.
 */
export function duplicateElements(
  elements: CanvasElement[],
  ids: ReadonlySet<string>,
  offset = 20,
): CanvasElement[] {
  const maxZ = topZ(elements);
  const copies = elements
    .filter((el) => ids.has(el.id))
    .sort((a, b) => a.z - b.z)
    .map((el, i) => ({
      ...el,
      id: crypto.randomUUID(),
      x: el.x + offset,
      y: el.y + offset,
      z: maxZ + i + 1,
    }));
  return [...elements, ...copies];
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
    width: opts?.width ?? 320,
    height: opts?.height ?? 40,
    rotation: 0,
    z,
    locked: false,
    visible: true,
    body: null,
    text: '',
  };
}

/** A document-width page-writing column (Google-Docs-style long-form writing).
 *  Anchored by its TOP-LEFT at (x, y); height auto-grows as the user types. */
export const PAGE_TEXT_WIDTH = 720;
export function createPageTextAt(x: number, y: number, z: number): TextBoxElement {
  return createTextBoxAt(x, y, z, { width: PAGE_TEXT_WIDTH, height: 56 });
}
