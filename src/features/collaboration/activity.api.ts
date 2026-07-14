import { supabase } from '@/lib/supabase';
import type { ActivityEntry } from '@/types/database';

/**
 * Supabase data layer for the activity feed. The log is append-only and written
 * only by SECURITY DEFINER triggers; clients can only READ it, and only for
 * projects they belong to (RLS). Newest first.
 */

export async function fetchProjectActivity(projectId: string, limit = 50): Promise<ActivityEntry[]> {
  const { data, error } = await supabase
    .from('activity_log')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

/** Page size for the infinite project feed. */
export const ACTIVITY_PAGE_SIZE = 30;

/**
 * One newest-first page of the project feed, using keyset (cursor) pagination:
 * pass the previous page's oldest `created_at` as `before` to fetch older rows.
 * Keyset beats OFFSET here — the log is append-only, so a stable `created_at <
 * before` window never skips or repeats rows as new activity arrives on top.
 */
export async function fetchProjectActivityPage(input: {
  projectId: string;
  before?: string;
  limit?: number;
}): Promise<ActivityEntry[]> {
  const limit = input.limit ?? ACTIVITY_PAGE_SIZE;
  let query = supabase
    .from('activity_log')
    .select('*')
    .eq('project_id', input.projectId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (input.before) query = query.lt('created_at', input.before);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

/** Activity scoped to one card (matched on meta->>card_id). */
export async function fetchCardActivity(
  projectId: string,
  cardId: string,
  limit = 30,
): Promise<ActivityEntry[]> {
  const { data, error } = await supabase
    .from('activity_log')
    .select('*')
    .eq('project_id', projectId)
    .eq('meta->>card_id', cardId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}
