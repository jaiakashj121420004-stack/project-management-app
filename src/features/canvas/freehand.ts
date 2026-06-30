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
import type { CanvasElement, StrokeBlend, StrokeElement } from './elements';

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
}

/** The full pen style a stroke is committed with (shape + look). */
export interface StrokeStyle extends StrokeShape {
  color: string;
  opacity: number;
  blend: StrokeBlend;
}

/** Group a flattened `[x, y, pressure, …]` array into perfect-freehand input. */
function toSamples(points: number[]): Array<[number, number, number]> {
  const samples: Array<[number, number, number]> = [];
  for (let i = 0; i + 1 < points.length; i += 3) {
    samples.push([points[i]!, points[i + 1]!, points[i + 2] ?? 0.5]);
  }
  return samples;
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
  return getStroke(samples, {
    size: shape.size,
    thinning: shape.thinning,
    smoothing: shape.smoothing,
    streamline: STREAMLINE,
    simulatePressure: shape.simulatePressure,
    last: true,
  });
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
  };
}

/** Map a stroke's LOCAL sample to WORLD space, honouring its transform box. */
function localToWorld(stroke: StrokeElement, lx: number, ly: number): [number, number] {
  const rad = (stroke.rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return [stroke.x + lx * cos - ly * sin, stroke.y + lx * sin + ly * cos];
}

/** True if (x,y) is within `radius` of any eraser point (squared-distance test). */
function nearEraser(x: number, y: number, eraser: readonly ErasePoint[], radius: number): boolean {
  const r2 = radius * radius;
  for (const p of eraser) {
    const dx = x - p.x;
    const dy = y - p.y;
    if (dx * dx + dy * dy <= r2) return true;
  }
  return false;
}

/**
 * Precision-erase a single stroke: remove the sample points the eraser passed
 * over (within `radius`, world units) and split the surviving runs into separate
 * strokes. Returns `null` when the eraser never touched this stroke (so the caller
 * keeps the original untouched), or the list of surviving pieces (possibly empty
 * if the whole stroke was erased). Each piece is rebuilt from world points, so it
 * gets a fresh bounding box but renders identically to the part that remained.
 */
export function erasePartialStroke(
  stroke: StrokeElement,
  eraser: readonly ErasePoint[],
  radius: number,
  existing: readonly CanvasElement[],
): StrokeElement[] | null {
  const style = styleOf(stroke);
  // A run is a contiguous list of surviving world samples [x, y, pressure, …].
  const runs: number[][] = [];
  let current: number[] = [];
  let erasedAny = false;

  for (let i = 0; i + 1 < stroke.points.length; i += 3) {
    const lx = stroke.points[i]!;
    const ly = stroke.points[i + 1]!;
    const pressure = stroke.points[i + 2] ?? 0.5;
    const [wx, wy] = localToWorld(stroke, lx, ly);
    if (nearEraser(wx, wy, eraser, radius)) {
      erasedAny = true;
      if (current.length > 0) {
        runs.push(current);
        current = [];
      }
    } else {
      current.push(wx, wy, pressure);
    }
  }
  if (current.length > 0) runs.push(current);

  if (!erasedAny) return null; // untouched — caller keeps the original stroke

  const pieces: StrokeElement[] = [];
  let pool = existing;
  for (const run of runs) {
    if (run.length < 6) continue; // need ≥2 samples to be a visible stroke
    const piece = buildStroke(run, style, pool);
    if (piece) {
      pieces.push(piece);
      pool = [...pool, piece]; // keep z values climbing for subsequent pieces
    }
  }
  return pieces;
}