import { useQuery, type QueryKey } from '@tanstack/react-query';
import { useOptimisticMutation } from '@/lib/useOptimisticMutation';
import type { Goal } from '@/types/database';
import { fetchGoals, insertGoal, removeGoal, updateGoal } from './api';
import type { GoalFormInput } from './schemas';

/**
 * A project's goals live in one cache entry, `['goals', projectId]` →
 * Goal[], oldest first — the same one-snapshot-per-project shape as
 * automations (useAutomations.ts), wrapped over the shared
 * useOptimisticMutation primitive (lib/useOptimisticMutation.ts).
 */
const goalsKey = (projectId: string): QueryKey => ['goals', projectId];

export function useGoals(projectId: string | undefined) {
  return useQuery({
    queryKey: goalsKey(projectId ?? ''),
    enabled: Boolean(projectId),
    queryFn: () => fetchGoals(projectId as string),
  });
}

/** Optimistic placeholder columns for a goal that hasn't hit the server yet —
 *  mirrors api.ts's toProgressColumns so the temp row renders exactly like the
 *  one that will come back. */
function placeholderProgress(input: GoalFormInput): {
  manual_percent: number | null;
  linked_card_id: string | null;
} {
  return input.progressType === 'manual_percent'
    ? { manual_percent: input.manualPercent, linked_card_id: null }
    : { manual_percent: null, linked_card_id: input.linkedCardId };
}

export function useCreateGoal(projectId: string, ownerId: string) {
  return useOptimisticMutation<Goal, GoalFormInput & { tempId: string }, Goal[]>({
    queryKey: goalsKey(projectId),
    mutationFn: (input) => insertGoal(projectId, ownerId, input),
    patch: (old, input) => [
      ...(old ?? []),
      {
        id: input.tempId,
        project_id: projectId,
        owner_id: ownerId,
        title: input.title.trim(),
        // The create form never sets a description (see schemas.ts).
        description: null,
        target_date: input.targetDate,
        progress_type: input.progressType,
        created_at: new Date().toISOString(),
        ...placeholderProgress(input),
      },
    ],
    reconcile: (old, created, { tempId }) =>
      old.map((goal) => (goal.id === tempId ? created : goal)),
  });
}

export function useUpdateGoal(projectId: string) {
  return useOptimisticMutation<Goal, { id: string } & GoalFormInput, Goal[]>({
    queryKey: goalsKey(projectId),
    mutationFn: ({ id, ...input }) => updateGoal(id, input),
    patch: (old, { id, ...input }) =>
      (old ?? []).map((goal) =>
        goal.id === id
          ? {
              ...goal,
              title: input.title.trim(),
              target_date: input.targetDate,
              progress_type: input.progressType,
              ...placeholderProgress(input),
            }
          : goal,
      ),
    reconcile: (old, updated) => old.map((goal) => (goal.id === updated.id ? updated : goal)),
  });
}

export function useDeleteGoal(projectId: string) {
  return useOptimisticMutation<void, { id: string }, Goal[]>({
    queryKey: goalsKey(projectId),
    mutationFn: ({ id }) => removeGoal(id),
    patch: (old, { id }) => (old ?? []).filter((goal) => goal.id !== id),
  });
}
