import type { Card, Column } from '@/types/database';

/**
 * Fractional ordering for the Kanban board.
 *
 * Columns and cards each carry a numeric `position`; lists are rendered in
 * ascending order. To move an item we give it a position *between* its two new
 * neighbours — the midpoint of their positions — so a reorder writes exactly one
 * row and can never collide with an existing position. This is a fractional
 * (a.k.a. "between") strategy, not a full reindex: the rest of the list is left
 * untouched, which keeps moves cheap and optimistic updates trivial.
 *
 * Float64 midpoints support ~50 consecutive inserts into the *same* gap before
 * precision runs out — far beyond realistic board usage. A periodic rebalance
 * (renumber a list to clean multiples of STEP) is a Phase 10 polish item; until
 * then `positionBetween` is the single source of truth for ordering.
 */

/** Gap used when appending to an end of a list (no neighbour on one side). */
export const POSITION_STEP = 1000;

/**
 * A position strictly between `before` and `after`.
 * - both defined → their midpoint
 * - only `after` (inserting at the head) → one step below it
 * - only `before` (appending at the tail) → one step above it
 * - neither (first item in an empty list) → POSITION_STEP
 */
export function positionBetween(before: number | undefined, after: number | undefined): number {
  if (before !== undefined && after !== undefined) return (before + after) / 2;
  if (after !== undefined) return after - POSITION_STEP;
  if (before !== undefined) return before + POSITION_STEP;
  return POSITION_STEP;
}

/** Ascending-by-position comparator shared by columns and cards. */
export function byPosition<T extends { position: number }>(a: T, b: T): number {
  return a.position - b.position;
}

/**
 * The position an item should take to land at `index` in `ordered`, where
 * `ordered` is the destination list *excluding the item being moved* (already
 * sorted ascending). Reads the neighbours that will straddle the item and
 * returns their midpoint.
 */
export function positionForIndex(ordered: { position: number }[], index: number): number {
  const before = ordered[index - 1]?.position;
  const after = ordered[index]?.position;
  return positionBetween(before, after);
}

/** Cards of a column, sorted — the per-column list the UI renders. */
export function cardsInColumn(cards: Card[], columnId: string): Card[] {
  return cards.filter((card) => card.column_id === columnId).sort(byPosition);
}

/** Columns sorted into board order. */
export function sortColumns(columns: Column[]): Column[] {
  return [...columns].sort(byPosition);
}

/**
 * Is this a "Done"-type column? Drives the celebration when a card lands here.
 * Matched on name so user-renamed columns ("Shipped", "Complete") still count,
 * without needing a dedicated column type.
 */
export function isDoneColumn(name: string): boolean {
  return /\b(done|complete[d]?|shipped|finished)\b/i.test(name.trim());
}
