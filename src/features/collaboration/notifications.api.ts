import { supabase } from '@/lib/supabase';
import type { Notification } from '@/types/database';

/**
 * Supabase data layer for the notification inbox (the Topbar bell). Own-row RLS
 * means every query is implicitly scoped to the signed-in user — no client-side
 * user filter is needed or trusted. Notifications are written only by triggers;
 * the client may read them and flip read_at.
 */

export async function fetchNotifications(limit = 30): Promise<Notification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

export async function markNotificationRead(id: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id)
    .is('read_at', null);
  if (error) throw error;
}

export async function markAllNotificationsRead(): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .is('read_at', null);
  if (error) throw error;
}
