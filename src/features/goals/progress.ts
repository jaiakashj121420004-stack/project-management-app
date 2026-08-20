import type { ChecklistItem, Goal } from '@/types/database';

/**
 * A goal's progress, 0–100, as a whole percent. A `manual_percent` goal simply
 * reports the value someone set; a `linked_checklist` goal computes checked ÷
 * total from the linked card's checklist items every time this is called, so
 * the bar updates itself as the team ticks items — nobody has to remember to
 * move it (Task 24). Pure and side-effect-free so it's trivially unit-testable
 * and safe to call on every render.
 */
export function goalProgress(goal: Goal, checklist: ChecklistItem[]): number {
  if (goal.progress_type === 'manual_percent') {
    return goal.manual_percent ?? 0;
  }
  if (!goal.linked_card_id) return 0;
  const items = checklist.filter((item) => item.card_id === goal.linked_card_id);
  if (items.length === 0) return 0;
  const done = items.filter((item) => item.is_done).length;
  return Math.round((done / items.length) * 100);
}

/** For a linked_checklist goal, the item counts backing its progress bar
 *  (`3/5`-style caption) — null when there's nothing to link to yet (no card
 *  chosen, or its checklist is empty). Manual-percent goals have no count. */
export function goalChecklistCounts(
  goal: Goal,
  checklist: ChecklistItem[],
): { done: number; total: number } | null {
  if (goal.progress_type !== 'linked_checklist' || !goal.linked_card_id) return null;
  const items = checklist.filter((item) => item.card_id === goal.linked_card_id);
  if (items.length === 0) return null;
  return { done: items.filter((item) => item.is_done).length, total: items.length };
}
