import { describe, it, expect } from 'vitest';
import { arrayMove } from '@dnd-kit/sortable';
import { POSITION_STEP, byPosition, neighbourPosition, positionBetween } from './ordering';

// The generic positionBetween/byPosition/needsRebalance/rebalancedPositions
// suites live in features/board/ordering.test.ts (re-exported from here, see
// that module's barrel) — this file covers `neighbourPosition`, the one piece
// hoisted here as part of sharing the board's drag-reorder math with the to-do
// planner (see memory.md's 2026-08-15 to-do drag-and-drop entry).

describe('neighbourPosition', () => {
  const positions: Record<string, number> = { a: 1000, b: 2000, c: 3000 };
  const getPosition = (id: string) => positions[id];

  it('lands between its new neighbours after a middle move', () => {
    // a, b, c → drag "c" to sit between "a" and "b".
    const order = arrayMove(['a', 'b', 'c'], 2, 1);
    expect(order).toEqual(['a', 'c', 'b']);
    expect(neighbourPosition(order, 'c', getPosition)).toBe(positionBetween(1000, 2000));
  });

  it('lands below everything when moved to the head', () => {
    const order = arrayMove(['a', 'b', 'c'], 2, 0);
    expect(order).toEqual(['c', 'a', 'b']);
    expect(neighbourPosition(order, 'c', getPosition)).toBe(1000 - POSITION_STEP);
  });

  it('lands above everything when moved to the tail', () => {
    const order = arrayMove(['a', 'b', 'c'], 0, 2);
    expect(order).toEqual(['b', 'c', 'a']);
    expect(neighbourPosition(order, 'a', getPosition)).toBe(3000 + POSITION_STEP);
  });

  it('is a no-op-shaped position when the item does not move', () => {
    const order = ['a', 'b', 'c'];
    expect(neighbourPosition(order, 'b', getPosition)).toBe(positionBetween(1000, 3000));
  });

  it('falls back to byPosition-comparable results for a single-item list', () => {
    const order = ['solo'];
    expect(neighbourPosition(order, 'solo', () => undefined)).toBe(POSITION_STEP);
    expect([{ position: neighbourPosition(order, 'solo', () => undefined) }].sort(byPosition)).toHaveLength(1);
  });
});
