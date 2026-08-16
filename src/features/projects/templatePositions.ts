/**
 * templatePositions.ts — pure positional math for seeding a template's
 * columns/cards/checklist items, split out from instantiateTemplate.ts so it
 * has zero dependency on the Supabase client (mirrors lib/ordering.ts's own
 * separation from any data layer) and is trivially unit-testable.
 */
import { positionForIndex } from '@/lib/ordering';

/**
 * `count` fresh, evenly-spaced fractional positions, computed with the same
 * shared `positionForIndex`/`positionBetween` primitives every other
 * drag-reorderable list in the app uses (board columns/cards, to-do
 * lists/items) — not hand-rolled arithmetic. Appending each position in turn
 * (there's never a "before" neighbour yet) yields the same clean
 * POSITION_STEP, 2·POSITION_STEP, … spacing the DB's own
 * `seed_project_columns()` trigger uses for a brand-new project's default
 * columns, so a template-seeded board behaves identically to a hand-built one
 * from the very first drag.
 */
export function sequentialPositions(count: number): number[] {
  const placed: { position: number }[] = [];
  for (let index = 0; index < count; index += 1) {
    const position = positionForIndex(placed, placed.length);
    placed.push({ position });
  }
  return placed.map((item) => item.position);
}
