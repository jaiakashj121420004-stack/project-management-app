import { supabase } from '@/lib/supabase';
import type { Feedback, FeedbackKind } from '@/types/database';

/**
 * Supabase data layer for feedback. Every call is governed by Row Level Security
 * (plan.md §6): a user may INSERT/SELECT only their own rows, and the admin may
 * SELECT all. These functions never filter by user themselves — the database
 * decides what is visible. The hooks in useFeedback.ts add caching + mutations.
 */

export interface NewFeedback {
  kind: FeedbackKind;
  message: string;
  /** Defaults to the signed-in user. The DB also defaults user_id to auth.uid()
   *  and RLS forbids inserting on someone else's behalf. */
  userId?: string;
}

/** Submit a piece of feedback, stamped with the current auth user's id. */
export async function submitFeedback(input: NewFeedback): Promise<Feedback> {
  let userId = input.userId;
  if (!userId) {
    const { data, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!data.user) throw new Error('You must be signed in to send feedback.');
    userId = data.user.id;
  }

  const { data, error } = await supabase
    .from('feedback')
    .insert({ user_id: userId, kind: input.kind, message: input.message })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

/**
 * Every submission, newest first — admin only. Goes through the
 * `admin_list_feedback` RPC (not a direct `.from('feedback').select()`) so the
 * read itself is recorded in `admin_audit_log`; a regular user calling this
 * RPC gets a permission error instead of silently getting only their own rows.
 */
export async function fetchAllFeedback(): Promise<Feedback[]> {
  const { data, error } = await supabase.rpc('admin_list_feedback');
  if (error) throw error;
  return data;
}
