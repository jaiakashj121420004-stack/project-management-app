import { positionBetween } from '@/lib/ordering';
import type { TodoItem } from '@/types/database';

/**
 * To-do item ordering: priority tiers first, fractional `position` as the
 * in-tier tiebreaker (and drag target). Priority always outranks manual order
 * — see `sameTier`/`demotedPosition` below and TodoListCard's drag/arrow-move
 * handlers, all of which refuse to reorder an item across a tier boundary
 * (documented decision: memory.md, 2026-08-15 to-do drag-and-drop entry).
 */

/** P1 first, then P2, … then unprioritised; position is only the in-tier tiebreaker. */
export function sortTodoItems(items: TodoItem[]): TodoItem[] {
  return [...items].sort((a, b) => {
    const pa = a.priority ?? Infinity;
    const pb = b.priority ?? Infinity;
    if (pa !== pb) return pa - pb;
    return a.position - b.position;
  });
}

/** True when two items share a priority tier (null/unset counts as its own tier). */
export function sameTier(a: Pick<TodoItem, 'priority'>, b: Pick<TodoItem, 'priority'>): boolean {
  return (a.priority ?? null) === (b.priority ?? null);
}

/**
 * The position `item` should take to sink after every other item in its own
 * priority tier — the one-time demotion applied when an item is checked done
 * (not an ongoing sort criterion; see TodoListCard). `siblings` is the full
 * list the item belongs to; items outside `item`'s tier are ignored.
 */
export function demotedPosition(item: TodoItem, siblings: readonly TodoItem[]): number {
  const lastInTier = siblings
    .filter((sibling) => sibling.id !== item.id && sameTier(sibling, item))
    .reduce((max, sibling) => Math.max(max, sibling.position), -Infinity);
  return positionBetween(lastInTier === -Infinity ? undefined : lastInTier, undefined);
}
