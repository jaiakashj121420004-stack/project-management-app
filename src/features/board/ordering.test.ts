import { describe, it, expect } from 'vitest';
import type { Card, Column } from '@/types/database';
import {
  POSITION_STEP,
  byPosition,
  cardsInColumn,
  isDoneColumn,
  positionBetween,
  positionForIndex,
  sortColumns,
} from './ordering';

// Minimal typed fixtures — the ordering helpers only read `position` (and, for
// cards, `column_id`), so we cast partial rows rather than build full DB shapes.
const card = (id: string, columnId: string, position: number): Card =>
  ({ id, column_id: columnId, position }) as unknown as Card;
const column = (id: string, position: number): Column =>
  ({ id, position }) as unknown as Column;

describe('positionBetween', () => {
  it('returns the midpoint when both neighbours exist', () => {
    expect(positionBetween(0, 100)).toBe(50);
    expect(positionBetween(1000, 2000)).toBe(1500);
  });

  it('inserts one step below when only the following neighbour exists (head)', () => {
    expect(positionBetween(undefined, 1000)).toBe(1000 - POSITION_STEP);
  });

  it('appends one step above when only the preceding neighbour exists (tail)', () => {
    expect(positionBetween(2000, undefined)).toBe(2000 + POSITION_STEP);
  });

  it('returns POSITION_STEP for the first item in an empty list', () => {
    expect(positionBetween(undefined, undefined)).toBe(POSITION_STEP);
  });

  it('always lands strictly between its neighbours', () => {
    const mid = positionBetween(10, 11);
    expect(mid).toBeGreaterThan(10);
    expect(mid).toBeLessThan(11);
  });
});

describe('positionForIndex', () => {
  const ordered = [{ position: 100 }, { position: 200 }, { position: 300 }];

  it('places at the head (below the first)', () => {
    expect(positionForIndex(ordered, 0)).toBe(100 - POSITION_STEP);
  });

  it('places between two existing items', () => {
    expect(positionForIndex(ordered, 1)).toBe(150);
    expect(positionForIndex(ordered, 2)).toBe(250);
  });

  it('appends at the tail (above the last)', () => {
    expect(positionForIndex(ordered, ordered.length)).toBe(300 + POSITION_STEP);
  });
});

describe('byPosition', () => {
  it('sorts ascending by position', () => {
    const items = [{ position: 3 }, { position: 1 }, { position: 2 }];
    expect([...items].sort(byPosition).map((i) => i.position)).toEqual([1, 2, 3]);
  });
});

describe('cardsInColumn', () => {
  it('filters to the column and sorts by position', () => {
    const cards = [
      card('a', 'col1', 200),
      card('b', 'col2', 50),
      card('c', 'col1', 100),
    ];
    expect(cardsInColumn(cards, 'col1').map((c) => c.id)).toEqual(['c', 'a']);
  });

  it('returns an empty array for a column with no cards', () => {
    expect(cardsInColumn([card('a', 'col1', 1)], 'other')).toEqual([]);
  });
});

describe('sortColumns', () => {
  it('returns a new array sorted by position without mutating the input', () => {
    const cols = [column('a', 30), column('b', 10), column('c', 20)];
    const sorted = sortColumns(cols);
    expect(sorted.map((c) => c.id)).toEqual(['b', 'c', 'a']);
    expect(cols.map((c) => c.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('isDoneColumn', () => {
  it('matches common "done"-type names case-insensitively', () => {
    for (const name of ['Done', 'done', 'Complete', 'Completed', 'Shipped', 'Finished']) {
      expect(isDoneColumn(name)).toBe(true);
    }
  });

  it('ignores surrounding whitespace', () => {
    expect(isDoneColumn('  Done  ')).toBe(true);
  });

  it('does not match unrelated column names', () => {
    for (const name of ['To Do', 'In Progress', 'Backlog', 'Doing']) {
      expect(isDoneColumn(name)).toBe(false);
    }
  });
});
