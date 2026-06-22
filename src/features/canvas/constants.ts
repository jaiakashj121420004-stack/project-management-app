/** Shared canvas constants + view types (P3.1). */

/** The camera that maps world coordinates to the screen: pan (x, y) + zoom. */
export interface Camera {
  /** Stage offset in screen pixels (Konva stage x/y). */
  x: number;
  y: number;
  /** Uniform zoom factor (Konva stage scaleX/scaleY). */
  scale: number;
}

/** Active interaction mode. P3.1 has only 'select'; 'draw' arrives in P3.2. */
export type CanvasTool = 'select';

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
