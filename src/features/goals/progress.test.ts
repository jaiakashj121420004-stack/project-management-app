import { describe, expect, it } from 'vitest';
import type { ChecklistItem, Goal } from '@/types/database';
import { goalChecklistCounts, goalProgress } from './progress';

function makeGoal(overrides: Partial<Goal> = {}): Goal {
  return {
    id: 'goal-1',
    project_id: 'project-1',
    owner_id: 'user-1',
    title: 'Ship v1',
    description: null,
    target_date: null,
    progress_type: 'manual_percent',
    manual_percent: 40,
    linked_card_id: null,
    created_at: '2026-08-20T00:00:00.000Z',
    ...overrides,
  };
}

function makeItem(overrides: Partial<ChecklistItem>): ChecklistItem {
  return {
    id: 'item',
    card_id: 'card-1',
    text: 'Item',
    is_done: false,
    position: 0,
    created_at: '2026-08-20T00:00:00.000Z',
    ...overrides,
  };
}

describe('goalProgress', () => {
  it('reports the stored value for a manual_percent goal', () => {
    expect(goalProgress(makeGoal({ manual_percent: 65 }), [])).toBe(65);
  });

  it('treats a null manual_percent as 0 (defensive — the DB CHECK forbids it)', () => {
    expect(goalProgress(makeGoal({ manual_percent: null }), [])).toBe(0);
  });

  it('computes checked/total for a linked_checklist goal', () => {
    const goal = makeGoal({
      progress_type: 'linked_checklist',
      manual_percent: null,
      linked_card_id: 'card-1',
    });
    const checklist = [
      makeItem({ id: 'a', card_id: 'card-1', is_done: true }),
      makeItem({ id: 'b', card_id: 'card-1', is_done: true }),
      makeItem({ id: 'c', card_id: 'card-1', is_done: false }),
      makeItem({ id: 'd', card_id: 'card-1', is_done: false }),
      // A different card's items must never leak into this goal's count.
      makeItem({ id: 'e', card_id: 'card-2', is_done: true }),
    ];
    expect(goalProgress(goal, checklist)).toBe(50);
  });

  it('is 0 for a linked_checklist goal with no card chosen yet', () => {
    const goal = makeGoal({
      progress_type: 'linked_checklist',
      manual_percent: null,
      linked_card_id: null,
    });
    expect(goalProgress(goal, [makeItem({ card_id: 'card-1', is_done: true })])).toBe(0);
  });

  it('is 0 for a linked_checklist goal whose card has an empty checklist', () => {
    const goal = makeGoal({
      progress_type: 'linked_checklist',
      manual_percent: null,
      linked_card_id: 'card-1',
    });
    expect(goalProgress(goal, [])).toBe(0);
  });
});

describe('goalChecklistCounts', () => {
  it('returns done/total for a linked_checklist goal with items', () => {
    const goal = makeGoal({
      progress_type: 'linked_checklist',
      manual_percent: null,
      linked_card_id: 'card-1',
    });
    const checklist = [
      makeItem({ id: 'a', card_id: 'card-1', is_done: true }),
      makeItem({ id: 'b', card_id: 'card-1', is_done: false }),
    ];
    expect(goalChecklistCounts(goal, checklist)).toEqual({ done: 1, total: 2 });
  });

  it('returns null for a manual_percent goal', () => {
    expect(goalChecklistCounts(makeGoal(), [])).toBeNull();
  });

  it('returns null when nothing is linked yet', () => {
    const goal = makeGoal({
      progress_type: 'linked_checklist',
      manual_percent: null,
      linked_card_id: null,
    });
    expect(goalChecklistCounts(goal, [])).toBeNull();
  });
});
