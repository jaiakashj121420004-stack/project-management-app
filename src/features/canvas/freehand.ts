/**
 * freehand.ts — turning raw pointer samples into a rendered stroke.
 *
 * Pure geometry over perfect-freehand: no React, no Konva, no DOM — so it stays
 * cheap to reason about and trivially unit-testable. Two jobs:
 *   1. strokePathData() — recompute a stroke's filled outline as an SVG path
 *      string (consumed by a Konva <Path>) from its stored input samples.
 *   2. buildStroke() — turn the raw WORLD-space samples captured during a draw
 *      gesture into a persisted StrokeElement (local-space points + transform box).
 */
import { getStroke } from 'perfect-freehand';
import { topZ } from './elements';
import type { CanvasElement, StrokeBlend, StrokeElement, StrokeTexture } from './elements';

/** A point the precision eraser passed over (world coordinates). */
export interface ErasePoint {
  x: number;
  y: number;
}

/** Light input smoothing — tracks the pen closely without the jitter of raw
 *  device samples. Shared by the live preview and the committed render. */
const STREAMLINE = 0.5;

/** The perfect-freehand shape params resolved from a stroke (or live pen). */
export interface StrokeShape {
  size: number;
  thinning: number;
  smoothing: number;
  simulatePressure: boolean;
  /** Tapered tip length in world px (0 / undefined = blunt). */
  taper?: number;
}

/** The full pen style a stroke is committed with (shape + look). */
export interface StrokeStyle extends StrokeShape {
  color: string;
  opacity: number;
  blend: StrokeBlend;
  texture?: StrokeTexture;
}

/** Group a flattened `[x, y, pressure, …]` array into perfect-freehand input. */
function toSamples(points: number[]): Array<[number, number, number]> {
  const samples: Array<[number, number, number]> = [];
  for (let i = 0; i + 1 < points.length; i += 3) {
    samples.push([points[i]!, points[i + 1]!, points[i + 2] ?? 0.5]);
  }
  return samples;
}

/** Max world-space gap between rendered samples. Raw pointer samples can be
 *  many px apart on a fast stroke; at high zoom the straight facets between them
 *  show as jaggies. Interpolating a smooth curve through them keeps ink crisp. */
const MAX_SAMPLE_GAP = 1;
const MAX_SUBDIVISIONS = 24;

type Sample = [number, number, number];

/**
 * Catmull-Rom subdivide a stroke's samples so no two neighbours are further
 * apart than MAX_SAMPLE_GAP. Original samples are kept exactly (so the curve
 * passes through them); pressure is interpolated linearly. Pure.
 */
export function densifySamples(samples: readonly Sample[]): Sample[] {
  const n = samples.length;
  if (n < 2) return samples.slice();
  const out: Sample[] = [samples[0]!];
  for (let i = 0; i < n - 1; i += 1) {
    const p0 = samples[Math.max(0, i - 1)]!;
    const p1 = samples[i]!;
    const p2 = samples[i + 1]!;
    const p3 = samples[Math.min(n - 1, i + 2)]!;
    const gap = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
    const steps = Math.min(MAX_SUBDIVISIONS, Math.ceil(gap / MAX_SAMPLE_GAP));
    for (let s = 1; s <= steps; s += 1) {
      const t = s / steps;
      if (s === steps) {
        out.push(p2);
        break;
      }
      const t2 = t * t;
      const t3 = t2 * t;
      const x =
        0.5 *
        (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 +
          (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3);
      const y =
        0.5 *
        (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 +
          (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3);
      out.push([x, y, p1[2] + (p2[2] - p1[2]) * t]);
    }
  }
  return out;
}

/** Snap a coordinate to 2dp so the path string stays compact. */
function round(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Build a quadratic-smoothed, closed SVG path from a perfect-freehand outline. */
function svgPath(outline: number[][]): string {
  if (outline.length === 0) return '';
  const first = outline[0]!;
  const parts: Array<string | number> = ['M', round(first[0]!), round(first[1]!), 'Q'];
  for (let i = 0; i < outline.length; i += 1) {
    const a = outline[i]!;
    const b = outline[(i + 1) % outline.length]!;
    parts.push(round(a[0]!), round(a[1]!), round((a[0]! + b[0]!) / 2), round((a[1]! + b[1]!) / 2));
  }
  parts.push('Z');
  return parts.join(' ');
}

/** Run perfect-freehand over a stroke's samples with the given shape params. */
function outlineFor(samples: Array<[number, number, number]>, shape: StrokeShape): number[][] {
  return getStroke(densifySamples(samples), {
    size: shape.size,
    thinning: shape.thinning,
    smoothing: shape.smoothing,
    streamline: STREAMLINE,
    simulatePressure: shape.simulatePressure,
    last: true,
    ...(shape.taper ? { start: { taper: shape.taper }, end: { taper: shape.taper } } : {}),
  });
}

/**
 * The raw outline polygon for a stroke's samples. The live-drawing overlay
 * paints this straight onto a 2D canvas, skipping the SVG-string build + Konva
 * path parse that made long strokes lag.
 */
export function strokeOutline(points: number[], shape: StrokeShape): number[][] {
  const samples = toSamples(points);
  return samples.length === 0 ? [] : outlineFor(samples, shape);
}

/** The filled-outline SVG path for a stroke's stored samples + shape params. */
export function strokePathData(points: number[], shape: StrokeShape): string {
  const samples = toSamples(points);
  if (samples.length === 0) return '';
  return svgPath(outlineFor(samples, shape));
}

/**
 * Turn the raw WORLD-space samples of a finished draw gesture into a persisted
 * StrokeElement: compute the outline's bounding box (the transform box), then
 * re-express the samples in that box's LOCAL space so the stroke can be moved /
 * resized independently of everything else. Returns null for an empty gesture.
 */
export function buildStroke(
  worldPoints: number[],
  style: StrokeStyle,
  existing: readonly CanvasElement[],
): StrokeElement | null {
  const samples = toSamples(worldPoints);
  if (samples.length === 0) return null;
  const outline = outlineFor(samples, style);
  if (outline.length === 0) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const point of outline) {
    const x = point[0]!;
    const y = point[1]!;
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }

  // Re-express the input samples relative to the box origin (local space).
  const localPoints: number[] = [];
  for (const [x, y, pressure] of samples) {
    localPoints.push(x - minX, y - minY, pressure);
  }

  return {
    id: crypto.randomUUID(),
    type: 'stroke',
    x: minX,
    y: minY,
    width: Math.max(0, maxX - minX),
    height: Math.max(0, maxY - minY),
    rotation: 0,
    z: topZ(existing),
    locked: false,
    visible: true,
    points: localPoints,
    color: style.color,
    size: style.size,
    thinning: style.thinning,
    smoothing: style.smoothing,
    opacity: style.opacity,
    blend: style.blend,
    simulatePressure: style.simulatePressure,
    ...(style.taper ? { taper: style.taper } : {}),
    ...(style.texture ? { texture: style.texture } : {}),
  };
}

// ── precision (partial) eraser ───────────────────────────────────────────────

/** The pen style a stroke was drawn with (to rebuild its surviving pieces). */
function styleOf(stroke: StrokeElement): StrokeStyle {
  return {
    color: stroke.color,
    size: stroke.size,
    thinning: stroke.thinning,
    smoothing: stroke.smoothing,
    opacity: stroke.opacity,
    blend: stroke.blend,
    simulatePressure: stroke.simulatePressure,
    taper: stroke.taper,
    texture: stroke.texture,
  };
}

/** Map a stroke's LOCAL sample to WORLD space, honouring its transform box. */
function localToWorld(stroke: StrokeElement, lx: number, ly: number): [number, number] {
  const rad = (stroke.rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return [stroke.x + lx * cos - ly * sin, stroke.y + lx * sin + ly * cos];
}

/** Distance from (px,py) to the segment a→b (a===b degenerates to a point). */
function distToSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** True if (x,y) is within `reach` of the eraser's travelled path (a polyline). */
function nearEraser(x: number, y: number, eraser: readonly ErasePoint[], reach: number): boolean {
  if (eraser.length === 1) return Math.hypot(x - eraser[0]!.x, y - eraser[0]!.y) <= reach;
  for (let i = 0; i + 1 < eraser.length; i += 1) {
    const a = eraser[i]!;
    const b = eraser[i + 1]!;
    if (distToSegment(x, y, a.x, a.y, b.x, b.y) <= reach) return true;
  }
  return false;
}

/** Ink half-width a stroke can reach past its centre line (for exact cut edges). */
function inkHalfWidth(stroke: StrokeElement): number {
  return stroke.size * 0.45;
}

/**
 * Precision-erase a single stroke. The stroke is first densified into a smooth
 * 1px-spaced centre line, so the cut lands exactly where the nib's edge meets the
 * ink — not at the nearest sparse pointer sample (which removed visible chunks).
 * Samples within the nib radius + the ink's half-width are removed and the
 * surviving runs become separate strokes (their round caps end right at the nib
 * edge). Returns `null` when the eraser never touched the stroke (caller keeps
 * the original untouched) or the surviving pieces (possibly none).
 */
export function erasePartialStroke(
  stroke: StrokeElement,
  eraser: readonly ErasePoint[],
  radius: number,
  existing: readonly CanvasElement[],
): StrokeElement[] | null {
  if (eraser.length === 0) return null;
  const reach = radius + inkHalfWidth(stroke);

  // Cheap reject: the eraser path's box vs the stroke's box (both in world space).
  let eMinX = Infinity;
  let eMinY = Infinity;
  let eMaxX = -Infinity;
  let eMaxY = -Infinity;
  for (const p of eraser) {
    if (p.x < eMinX) eMinX = p.x;
    if (p.y < eMinY) eMinY = p.y;
    if (p.x > eMaxX) eMaxX = p.x;
    if (p.y > eMaxY) eMaxY = p.y;
  }
  const pad = reach + stroke.size;
  // Strokes rotate about their (x, y) origin, so bound them by that origin + diagonal.
  const cx = stroke.x;
  const cy = stroke.y;
  const half = Math.hypot(stroke.width, stroke.height) + pad;
  if (eMaxX < cx - half || eMinX > cx + half || eMaxY < cy - half || eMinY > cy + half) {
    return null;
  }

  const raw: Sample[] = [];
  for (let i = 0; i + 1 < stroke.points.length; i += 3) {
    const [wx, wy] = localToWorld(stroke, stroke.points[i]!, stroke.points[i + 1]!);
    raw.push([wx, wy, stroke.points[i + 2] ?? 0.5]);
  }
  const dense = densifySamples(raw);
  const rawKeys = new Set(raw.map((r) => `${r[0]}|${r[1]}`));

  const runs: Sample[][] = [];
  let current: Sample[] = [];
  let erasedAny = false;
  for (const sample of dense) {
    if (nearEraser(sample[0], sample[1], eraser, reach)) {
      erasedAny = true;
      if (current.length > 0) {
        runs.push(current);
        current = [];
      }
    } else {
      current.push(sample);
    }
  }
  if (current.length > 0) runs.push(current);
  if (!erasedAny) return null; // untouched — keep the original stroke

  const style = styleOf(stroke);
  const pieces: StrokeElement[] = [];
  let pool = existing;
  for (const run of runs) {
    if (run.length < 2) continue;
    // Keep the original samples plus the exact cut ends: compact to store, and
    // the curve through them matches what was on screen.
    const kept: number[] = [];
    run.forEach((sample, index) => {
      const isEnd = index === 0 || index === run.length - 1;
      if (isEnd || rawKeys.has(`${sample[0]}|${sample[1]}`)) kept.push(sample[0], sample[1], sample[2]);
    });
    const piece = buildStroke(kept, style, pool);
    if (piece) {
      pieces.push(piece);
      pool = [...pool, piece];
    }
  }
  return pieces;
}
