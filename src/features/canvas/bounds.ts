import type { CanvasElement } from './elements';
import type { Camera } from './constants';

/** A world-space axis-aligned bounding box. */
export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** The bounding box of every element (world units), or null for an empty scene.
 *  Rotation is ignored (uses each element's axis-aligned box) — good enough for
 *  the minimap + fit-to-content. */
export function sceneBounds(elements: CanvasElement[]): Bounds | null {
  if (elements.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const el of elements) {
    minX = Math.min(minX, el.x);
    minY = Math.min(minY, el.y);
    maxX = Math.max(maxX, el.x + el.width);
    maxY = Math.max(maxY, el.y + el.height);
  }
  if (!Number.isFinite(minX)) return null;
  return { minX, minY, maxX, maxY };
}

interface Viewport {
  width: number;
  height: number;
}

/** A camera that fits `bounds` centred in the viewport, with padding, clamped. */
export function fitCamera(
  bounds: Bounds,
  viewport: Viewport,
  clamp: (scale: number) => number,
  padding = 72,
): Camera {
  const bw = Math.max(1, bounds.maxX - bounds.minX);
  const bh = Math.max(1, bounds.maxY - bounds.minY);
  const scale = clamp(
    Math.min((viewport.width - padding * 2) / bw, (viewport.height - padding * 2) / bh),
  );
  const cx = (bounds.minX + bounds.maxX) / 2;
  const cy = (bounds.minY + bounds.maxY) / 2;
  return { scale, x: viewport.width / 2 - cx * scale, y: viewport.height / 2 - cy * scale };
}

/** A camera that centres the given world point in the viewport (keeps the scale). */
export function centerCamera(
  worldX: number,
  worldY: number,
  viewport: Viewport,
  scale: number,
): Camera {
  return { scale, x: viewport.width / 2 - worldX * scale, y: viewport.height / 2 - worldY * scale };
}
