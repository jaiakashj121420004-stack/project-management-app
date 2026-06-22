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
