import { supabase } from '@/lib/supabase';
import type { CeoMessage } from '@/types/database';

/**
 * Supabase data layer for the single "Message from the CEO". Every signed-in
 * user may SELECT it; only the admin may write it (RLS, plan.md §6). We keep one
 * current message: saving updates the existing row in place, or inserts the
 * first one. updated_at is maintained by a DB trigger, so writes never send it.
 */

/** The latest CEO message, or null if none has been written yet. */
export async function fetchLatestCeoMessage(): Promise<CeoMessage | null> {
  const { data, error } = await supabase
    .from('ceo_messages')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Post or update the current CEO message (admin only — RLS enforces it). If a
 * row already exists we UPDATE it; otherwise we INSERT the first one.
 */
export async function saveCeoMessage(message: string): Promise<CeoMessage> {
  const existing = await fetchLatestCeoMessage();

  if (existing) {
    const { data, error } = await supabase
      .from('ceo_messages')
      .update({ message })
      .eq('id', existing.id)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  }

  const { data, error } = await supabase
    .from('ceo_messages')
    .insert({ message })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}
