import { describe, it, expect } from 'vitest';
import type { TodoItem } from '@/types/database';
import { demotedPosition, sameTier, sortTodoItems } from './ordering';

const item = (id: string, position: number, priority: number | null = null, isDone = false): TodoItem => ({
  id,
  list_id: 'list-1',
  text: id,
  is_done: isDone,
  position,
  priority,
  created_at: '',
});

describe('sortTodoItems', () => {
  it('sorts P1 before P2 before unprioritised, regardless of position', () => {
    const items = [item('c', 100, null), item('a', 9000, 1), item('b', 500, 2)];
    expect(sortTodoItems(items).map((i) => i.id)).toEqual(['a', 'b', 'c']);
  });

  it('uses position as the in-tier tiebreaker', () => {
    const items = [item('b', 2000, 1), item('a', 1000, 1)];
    expect(sortTodoItems(items).map((i) => i.id)).toEqual(['a', 'b']);
  });

  it('does not mutate the input array', () => {
    const items = [item('b', 2000), item('a', 1000)];
    sortTodoItems(items);
    expect(items.map((i) => i.id)).toEqual(['b', 'a']);
  });
});

describe('sameTier', () => {
  it('treats equal priorities as the same tier', () => {
    expect(sameTier(item('a', 1, 2), item('b', 2, 2))).toBe(true);
  });

  it('treats null/unset priority as its own tier', () => {
    expect(sameTier(item('a', 1, null), item('b', 2, null))).toBe(true);
  });

  it('treats different priorities as different tiers', () => {
    expect(sameTier(item('a', 1, 1), item('b', 2, 2))).toBe(false);
    expect(sameTier(item('a', 1, 1), item('b', 2, null))).toBe(false);
  });
});

describe('demotedPosition', () => {
  it('lands after the last item in the same tier', () => {
    const siblings = [item('a', 1000, 1), item('b', 2000, 1), item('c', 3000, 1)];
    // 'a' is being checked off — it should sink below 'b' and 'c' (its tier-mates).
    expect(demotedPosition(siblings[0]!, siblings)).toBeGreaterThan(3000);
  });

  it('ignores items in other tiers when computing the tier-end', () => {
    const siblings = [item('a', 1000, 1), item('big-but-different-tier', 9_000_000, 2)];
    expect(demotedPosition(siblings[0]!, siblings)).toBeLessThan(9_000_000);
  });

  it('is a no-op-shaped move when the item is already alone in its tier', () => {
    const siblings = [item('a', 1000, 1)];
    expect(demotedPosition(siblings[0]!, siblings)).toBeGreaterThan(0);
  });

  it('unprioritised items only compete with other unprioritised items', () => {
    const siblings = [item('a', 1000, null), item('b', 2000, null), item('c', 500, 3)];
    expect(demotedPosition(siblings[0]!, siblings)).toBeGreaterThan(2000);
  });
});
