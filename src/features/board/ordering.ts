import type { Card, Column } from '@/types/database';
import { byPosition } from '@/lib/ordering';

/**
 * Board-specific ordering helpers. The fractional-position primitives
 * (`positionBetween`, `byPosition`, `needsRebalance`, `rebalancedPositions`,
 * `neighbourPosition`, …) live in `@/lib/ordering` — framework/table-agnostic,
 * shared with the to-do planner's list/item drag-and-drop — and are re-exported
 * here so existing imports from `./ordering` keep working unchanged.
 */
export {
  POSITION_STEP,
  REBALANCE_MIN_GAP,
  byPosition,
  needsRebalance,
  neighbourPosition,
  positionBetween,
  positionForIndex,
  rebalancedPositions,
  type Rebalanced,
} from '@/lib/ordering';

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
