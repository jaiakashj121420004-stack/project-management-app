import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import type { Notification } from '@/types/database';
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from './notifications.api';

/**
 * The signed-in user's notification inbox, powering the Topbar bell. Realtime is
 * subscribed HERE (not via useProjectRealtime, which is project-scoped) because
 * the bell is global and notifications are own-row: a single channel filtered to
 * this user invalidates the cache live, so the unread badge updates the moment a
 * trigger fires.
 */
const NOTIFICATIONS_KEY: QueryKey = ['notifications'];

export function useNotifications() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const query = useQuery({
    queryKey: NOTIFICATIONS_KEY,
    enabled: Boolean(user),
    queryFn: () => fetchNotifications(),
  });

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        () => {
          void queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user, queryClient]);

  const notifications = query.data ?? [];
  const unreadCount = notifications.reduce((count, n) => (n.read_at ? count : count + 1), 0);
  return { ...query, notifications, unreadCount };
}

interface NotificationsContext {
  previous?: Notification[];
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string, NotificationsContext>({
    mutationFn: (id) => markNotificationRead(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: NOTIFICATIONS_KEY });
      const previous = queryClient.getQueryData<Notification[]>(NOTIFICATIONS_KEY);
      const now = new Date().toISOString();
      queryClient.setQueryData<Notification[]>(NOTIFICATIONS_KEY, (old) =>
        (old ?? []).map((n) => (n.id === id && !n.read_at ? { ...n, read_at: now } : n)),
      );
      return { previous };
    },
    onError: (_error, _id, context) => {
      if (context?.previous) queryClient.setQueryData(NOTIFICATIONS_KEY, context.previous);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, void, NotificationsContext>({
    mutationFn: () => markAllNotificationsRead(),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: NOTIFICATIONS_KEY });
      const previous = queryClient.getQueryData<Notification[]>(NOTIFICATIONS_KEY);
      const now = new Date().toISOString();
      queryClient.setQueryData<Notification[]>(NOTIFICATIONS_KEY, (old) =>
        (old ?? []).map((n) => (n.read_at ? n : { ...n, read_at: now })),
      );
      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(NOTIFICATIONS_KEY, context.previous);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
    },
  });
}
