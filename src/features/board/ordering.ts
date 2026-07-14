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
 * precision runs out. Two things keep this robust under real (concurrent) use:
 *   1. A **stable tiebreaker** (`byPosition` falls back to `created_at`, then
 *      `id`) so two rows that momentarily share a position — e.g. two peers each
 *      picking the same midpoint before their writes reconcile — always render in
 *      one deterministic order instead of flickering between renders.
 *   2. A **rebalance** (`needsRebalance` / `rebalancedPositions`) that renumbers a
 *      list to clean multiples of STEP once any gap gets too tight, so a hot
 *      insertion point can never exhaust float precision.
 */

/** Gap used when appending to an end of a list (no neighbour on one side). */
export const POSITION_STEP = 1000;

/**
 * If any adjacent gap in a list falls below this, the list is a rebalance
 * candidate. Well above the float-precision floor (~1e-10 near these magnitudes)
 * so we renumber long before midpoints could actually collide.
 */
export const REBALANCE_MIN_GAP = 1e-4;

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

/**
 * Ascending-by-position comparator shared by columns, cards and checklist items.
 *
 * Equal positions are broken deterministically by `created_at` (older first),
 * then `id`, so concurrent midpoint moves that transiently produce identical
 * positions can never render in arbitrary — or worse, render-to-render varying —
 * order. Rows without those fields (bare `{ position }` fixtures) simply fall
 * through to a pure position sort, so existing callers are unaffected.
 */
export function byPosition<T extends { position: number; created_at?: string; id?: string }>(
  a: T,
  b: T,
): number {
  if (a.position !== b.position) return a.position - b.position;
  const at = a.created_at ?? '';
  const bt = b.created_at ?? '';
  if (at !== bt) return at < bt ? -1 : 1;
  const ai = a.id ?? '';
  const bi = b.id ?? '';
  return ai < bi ? -1 : ai > bi ? 1 : 0;
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

// ── Rebalancing ──────────────────────────────────────────────────────────────
// Midpoint inserts halve the gap each time, so a repeatedly-targeted insertion
// point eventually runs out of float precision. Rebalancing renumbers a list to
// clean, evenly-spaced positions (STEP, 2·STEP, …), restoring maximum head-room
// without changing the visible order. Callers detect the condition cheaply with
// `needsRebalance` and persist the few changed rows from `rebalancedPositions`.

/**
 * True when any adjacent gap in `items` (sorted with the stable comparator) has
 * shrunk below REBALANCE_MIN_GAP — the signal to renumber before precision runs
 * out. An empty or single-item list never needs rebalancing.
 */
export function needsRebalance<T extends { position: number; created_at?: string; id?: string }>(
  items: readonly T[],
): boolean {
  if (items.length < 2) return false;
  const sorted = [...items].sort(byPosition);
  for (let i = 1; i < sorted.length; i += 1) {
    // Non-null: i and i-1 are both in-range for a length ≥ 2 list.
    const gap = sorted[i]!.position - sorted[i - 1]!.position;
    if (gap < REBALANCE_MIN_GAP) return true;
  }
  return false;
}

/** One item's new clean position after a rebalance. */
export interface Rebalanced {
  id: string;
  position: number;
}

/**
 * Renumber `items` to clean multiples of POSITION_STEP in their current stable
 * order, returning only the rows whose position actually changed (so a caller
 * writes the minimum number of updates). The visible order is preserved exactly.
 */
export function rebalancedPositions<
  T extends { id: string; position: number; created_at?: string },
>(items: readonly T[]): Rebalanced[] {
  const sorted = [...items].sort(byPosition);
  const changed: Rebalanced[] = [];
  sorted.forEach((item, index) => {
    const position = (index + 1) * POSITION_STEP;
    if (position !== item.position) changed.push({ id: item.id, position });
  });
  return changed;
}
