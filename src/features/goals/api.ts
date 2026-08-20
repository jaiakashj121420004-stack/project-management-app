import { supabase } from '@/lib/supabase';
import type { Goal } from '@/types/database';
import type { GoalFormInput } from './schemas';

/**
 * Thin Supabase data layer for goals (Task 24). Every call is governed by Row
 * Level Security — any project member may read/write (20260820120000_goals.sql)
 * — these functions never filter by user themselves. useGoals.ts wraps these
 * with caching + optimistic updates, the same shape as projects/api.ts and
 * automations/api.ts.
 */

/** All goals for a project, oldest first — a flat list, no ordering UI. */
export async function fetchGoals(projectId: string): Promise<Goal[]> {
  const { data, error } = await supabase
    .from('goals')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data;
}

/** Turn the form's flat shape into the row's mutually-exclusive progress
 *  columns — mirrors the DB's own `goals_progress_shape` CHECK so a well-formed
 *  input here can never be rejected server-side for shape reasons. */
function toProgressColumns(input: GoalFormInput): {
  manual_percent: number | null;
  linked_card_id: string | null;
} {
  return input.progressType === 'manual_percent'
    ? { manual_percent: input.manualPercent, linked_card_id: null }
    : { manual_percent: null, linked_card_id: input.linkedCardId };
}

export async function insertGoal(
  projectId: string,
  ownerId: string,
  input: GoalFormInput,
): Promise<Goal> {
  const { data, error } = await supabase
    .from('goals')
    .insert({
      project_id: projectId,
      owner_id: ownerId,
      title: input.title,
      // The create/edit form never sets a description (see schemas.ts) — the
      // column exists in the data model for a future affordance, unused today.
      description: null,
      target_date: input.targetDate,
      progress_type: input.progressType,
      ...toProgressColumns(input),
    })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function updateGoal(id: string, input: GoalFormInput): Promise<Goal> {
  const { data, error } = await supabase
    .from('goals')
    .update({
      title: input.title,
      target_date: input.targetDate,
      progress_type: input.progressType,
      ...toProgressColumns(input),
    })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function removeGoal(id: string): Promise<void> {
  const { error } = await supabase.from('goals').delete().eq('id', id);
  if (error) throw error;
}
