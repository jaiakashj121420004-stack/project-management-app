/**
 * selection.ts — which elements does a lasso loop or a dragged rectangle pick up?
 * Pure geometry in WORLD space (no React / Konva) so it is cheap to unit test.
 */
import { densifySamples } from './freehand';
import { isLineShape, lineEndpoints } from './shapes';
import type { CanvasElement, StrokeElement } from './elements';

export interface WorldPoint {
  x: number;
  y: number;
}
export interface WorldRect {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** The four corners of an element's (possibly rotated) box, clockwise from its origin. */
function corners(el: CanvasElement): WorldPoint[] {
  const rad = (el.rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return [
    [0, 0],
    [el.width, 0],
    [el.width, el.height],
    [0, el.height],
  ].map(([lx, ly]) => ({ x: el.x + lx! * cos - ly! * sin, y: el.y + lx! * sin + ly! * cos }));
}

/** A stroke's centre-line samples in world space (smoothed, so gaps are filled). */
function strokeSamples(el: StrokeElement): WorldPoint[] {
  const rad = (el.rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const raw: Array<[number, number, number]> = [];
  for (let i = 0; i + 1 < el.points.length; i += 3) {
    const lx = el.points[i]!;
    const ly = el.points[i + 1]!;
    raw.push([el.x + lx * cos - ly * sin, el.y + lx * sin + ly * cos, 0.5]);
  }
  return densifySamples(raw).map(([x, y]) => ({ x, y }));
}

/** Ray-casting point-in-polygon. */
export function pointInPolygon(p: WorldPoint, poly: readonly WorldPoint[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i, i += 1) {
    const a = poly[i]!;
    const b = poly[j]!;
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) {
      inside = !inside;
    }
  }
  return inside;
}

function inRect(p: WorldPoint, r: WorldRect): boolean {
  return p.x >= r.minX && p.x <= r.maxX && p.y >= r.minY && p.y <= r.maxY;
}

function selectable(el: CanvasElement): boolean {
  return el.visible !== false;
}

/** Everything a dragged rectangle touches (strokes: only if their ink does). */
export function elementsInRect(elements: readonly CanvasElement[], rect: WorldRect): string[] {
  const hits: string[] = [];
  for (const el of elements) {
    if (!selectable(el)) continue;
    if (el.type === 'stroke') {
      if (strokeSamples(el).some((p) => inRect(p, rect))) hits.push(el.id);
      continue;
    }
    const pts = isLineShape(el) ? lineEndpoints(el) : corners(el);
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    const overlaps =
      Math.min(...xs) <= rect.maxX &&
      Math.max(...xs) >= rect.minX &&
      Math.min(...ys) <= rect.maxY &&
      Math.max(...ys) >= rect.minY;
    if (overlaps) hits.push(el.id);
  }
  return hits;
}

/** Everything a freehand loop encloses (a rough loop is fine: a third of a
 *  stroke, a shape's centre or two corners inside is enough). */
export function elementsInLasso(
  elements: readonly CanvasElement[],
  polygon: readonly WorldPoint[],
): string[] {
  if (polygon.length < 3) return [];
  const hits: string[] = [];
  for (const el of elements) {
    if (!selectable(el)) continue;
    if (el.type === 'stroke') {
      const samples = strokeSamples(el);
      if (samples.length === 0) continue;
      const inside = samples.filter((p) => pointInPolygon(p, polygon)).length;
      if (inside / samples.length >= 0.35) hits.push(el.id);
      continue;
    }
    if (isLineShape(el)) {
      const [a, b] = lineEndpoints(el);
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const count = [a, b, mid].filter((p) => pointInPolygon(p, polygon)).length;
      if (count >= 2) hits.push(el.id);
      continue;
    }
    const cs = corners(el);
    const center = { x: (cs[0]!.x + cs[2]!.x) / 2, y: (cs[0]!.y + cs[2]!.y) / 2 };
    const cornersIn = cs.filter((p) => pointInPolygon(p, polygon)).length;
    if (pointInPolygon(center, polygon) || cornersIn >= 2) hits.push(el.id);
  }
  return hits;
}
