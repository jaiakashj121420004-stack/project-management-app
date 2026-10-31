import { describe, expect, it } from 'vitest';
import { buildStroke, densifySamples, erasePartialStroke } from './freehand';

const style = { color: '#000', size: 6, thinning: 0.5, smoothing: 0.5, opacity: 1, blend: 'normal' as const, simulatePressure: true };

describe('densifySamples', () => {
  it('fills gaps so neighbours are at most ~1px apart and keeps the originals', () => {
    const out = densifySamples([[0, 0, 0.5], [50, 0, 0.5], [100, 40, 0.5]]);
    for (let i = 1; i < out.length; i += 1) {
      expect(Math.hypot(out[i]![0] - out[i - 1]![0], out[i]![1] - out[i - 1]![1])).toBeLessThan(5);
    }
    expect(out[0]).toEqual([0, 0, 0.5]);
    expect(out.some((p) => p[0] === 50 && p[1] === 0)).toBe(true);
  });
});

describe('erasePartialStroke', () => {
  // A long straight stroke drawn with only 3 sparse samples (a fast flick).
  const sparse = buildStroke([0, 0, 0.5, 100, 0, 0.5, 200, 0, 0.5], style, [])!;

  it('removes only the ink under the nib, not the whole gap between samples', () => {
    const pieces = erasePartialStroke(sparse, [{ x: 100, y: 0 }], 4, [sparse])!;
    expect(pieces).toHaveLength(2);
    const [left, right] = pieces;
    // nib radius 4 + half-width ~2.7: the cut is ~7px wide, not 100px
    const gap = right!.x - (left!.x + left!.width);
    expect(gap).toBeGreaterThan(0);
    expect(gap).toBeLessThan(16);
  });

  it('returns null when the eraser misses', () => {
    expect(erasePartialStroke(sparse, [{ x: 100, y: 80 }], 4, [sparse])).toBeNull();
  });

  it('a scrub segment between two sparse points erases everything along it', () => {
    const pieces = erasePartialStroke(sparse, [{ x: 20, y: 0 }, { x: 180, y: 0 }], 4, [sparse])!;
    const kept = pieces.reduce((n, p) => n + p.width, 0);
    expect(kept).toBeLessThan(40);
  });
});
