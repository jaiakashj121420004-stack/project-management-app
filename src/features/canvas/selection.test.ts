import { describe, expect, it } from 'vitest';
import { elementsInLasso, elementsInRect, pointInPolygon } from './selection';
import { buildStroke } from './freehand';
import { createClosedShape, createLineShape, defaultShapeStyle } from './shapes';
import type { CanvasElement } from './elements';

const style = { color: '#000', size: 4, thinning: 0.5, smoothing: 0.5, opacity: 1, blend: 'normal' as const, simulatePressure: true };
const ink = defaultShapeStyle('rect', '#111');

function stroke(points: Array<[number, number]>): CanvasElement {
  const flat = points.flatMap(([x, y]) => [x, y, 0.5]);
  const s = buildStroke(flat, style, []);
  if (!s) throw new Error('no stroke');
  return s;
}

describe('selection', () => {
  const square = [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 100 },
    { x: 0, y: 100 },
  ];

  it('pointInPolygon', () => {
    expect(pointInPolygon({ x: 50, y: 50 }, square)).toBe(true);
    expect(pointInPolygon({ x: 150, y: 50 }, square)).toBe(false);
  });

  it('rect picks strokes whose ink is inside, not strokes whose box merely overlaps', () => {
    const inside = stroke([[10, 10], [40, 40]]);
    const outside = stroke([[300, 300], [340, 340]]);
    // an L-shaped stroke whose bounding box covers the rect but whose ink does not
    const elbow = stroke([[200, 0], [200, 200], [0, 200]]);
    const ids = elementsInRect([inside, outside, elbow], { minX: 0, minY: 0, maxX: 100, maxY: 100 });
    expect(ids).toEqual([inside.id]);
  });

  it('lasso picks shapes by centre and arrows by endpoints', () => {
    const box = createClosedShape('rect', { x: 20, y: 20 }, { x: 60, y: 60 }, [], ink);
    const far = createClosedShape('rect', { x: 400, y: 400 }, { x: 460, y: 460 }, [], ink);
    const arrow = createLineShape('arrow', { x: 10, y: 80 }, { x: 90, y: 80 }, [], ink);
    const ids = elementsInLasso([box, far, arrow], square);
    expect(ids).toContain(box.id);
    expect(ids).toContain(arrow.id);
    expect(ids).not.toContain(far.id);
  });

  it('skips hidden elements', () => {
    const box = { ...createClosedShape('rect', { x: 20, y: 20 }, { x: 60, y: 60 }, [], ink), visible: false };
    expect(elementsInRect([box], { minX: 0, minY: 0, maxX: 100, maxY: 100 })).toEqual([]);
  });
});
