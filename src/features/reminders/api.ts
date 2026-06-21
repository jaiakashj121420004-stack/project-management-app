import { addDays, format } from 'date-fns';
import { supabase } from '@/lib/supabase';
import type { Card } from '@/types/database';

/**
 * Cards assigned to the current user that are due between today and `leadDays`
 * out (inclusive). RLS still applies, but we also filter by assignee so the
 * browser only pulls the handful of cards a reminder could fire for. Dates are
 * stored as local `YYYY-MM-DD`, matching features/board/due.ts.
 */
export async function fetchMyDueSoonCards(userId: string, leadDays: number): Promise<Card[]> {
  const today = format(new Date(), 'yyyy-MM-dd');
  const until = format(addDays(new Date(), Math.max(0, leadDays)), 'yyyy-MM-dd');

  const { data, error } = await supabase
    .from('cards')
    .select('*')
    .eq('assignee_id', userId)
    .not('due_date', 'is', null)
    .gte('due_date', today)
    .lte('due_date', until)
    .order('due_date', { ascending: true });
  if (error) throw error;
  return data;
}
