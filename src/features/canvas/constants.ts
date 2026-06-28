/** Shared canvas constants + view types (P3.1). */

/** The camera that maps world coordinates to the screen: pan (x, y) + zoom. */
export interface Camera {
  /** Stage offset in screen pixels (Konva stage x/y). */
  x: number;
  y: number;
  /** Uniform zoom factor (Konva stage scaleX/scaleY). */
  scale: number;
}

/**
 * Active interaction mode:
 *   - 'select' — pan (drag empty space), zoom, and select/move/resize elements;
 *   - 'draw'   — freehand pressure-sensitive strokes;
 *   - 'erase'  — eraser (removes whatever it touches);
 *   - 'text'   — click anywhere to drop a text box there and start typing.
 * Two-finger pan/zoom and wheel-zoom work in every mode.
 */
export type CanvasTool = 'select' | 'draw' | 'erase' | 'text';

/** Zoom bounds — far enough to overview a board, close enough to detail. */
export const MIN_SCALE = 0.2;
export const MAX_SCALE = 4;

/** A single zoom-button step. */
export const ZOOM_STEP = 1.2;

/** Smallest an element may be resized to (world pixels). */
export const MIN_ELEMENT_SIZE = 24;

/** Clamp the zoom factor to the allowed range. */
export function clampScale(scale: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
}

/**
 * An element's live transform box, in world units. Reported by a Konva element
 * during a drag/resize gesture so the HTML text overlay can follow the node in
 * real time (element state only updates on gesture end). `id` ties it to the
 * element it describes.
 */
export interface ElementBox {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}
