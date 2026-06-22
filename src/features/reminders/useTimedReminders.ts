import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { formatDueTime } from '@/lib/dueAt';
import { fetchUpcomingPushReminders, type UpcomingPushReminder } from './cardReminders.api';
import {
  alreadyReminded,
  markReminded,
  notificationPermission,
  showNotification,
  useBrowserRemindersPref,
} from './notifications';

const POLL_INTERVAL = 1000 * 60 * 5; // refetch the reminder set every 5 minutes
const SCAN_INTERVAL = 1000 * 60; // re-evaluate fire times every minute
const GRACE_MS = 1000 * 60 * 5; // still fire up to 5 min after due (covers 0-offset)

/** Stable per-reminder+due_at dedupe key; re-arms when due_at changes. */
function timedKey(reminder: UpcomingPushReminder): string {
  return `timed:${reminder.id}:${reminder.due_at}`;
}

/**
 * In-app browser notifications for Pro custom timed reminders (P1 — the
 * `channel = 'push'` half). Honors the same master switch as the day-based
 * path: permission granted + the Profile "Browser notifications" toggle + online.
 * Polls the user's upcoming push reminders, then fires each once when its offset
 * moment arrives — within [due_at − offset, due_at + grace], deduped in
 * localStorage so a given (reminder, due_at) shows exactly once. Mounted via
 * useDueReminders. The reliable, app-closed path is the email Edge Function.
 */
export function useTimedReminders(): void {
  const { user } = useAuth();
  const online = useOnlineStatus();
  const prefEnabled = useBrowserRemindersPref();

  const enabled =
    Boolean(user) && online && prefEnabled && notificationPermission() === 'granted';

  const { data } = useQuery({
    queryKey: ['timed-reminders', user?.id],
    enabled,
    queryFn: () => fetchUpcomingPushReminders(user!.id),
    refetchInterval: POLL_INTERVAL,
    refetchOnWindowFocus: true,
    staleTime: POLL_INTERVAL,
  });

  useEffect(() => {
    if (!enabled || !data || data.length === 0) return;

    const scan = () => {
      const now = Date.now();
      for (const reminder of data) {
        const dueMs = new Date(reminder.due_at).getTime();
        const fireMs = dueMs - reminder.offset_minutes * 60_000;
        if (now < fireMs || now > dueMs + GRACE_MS) continue; // outside the fire window
        const key = timedKey(reminder);
        if (alreadyReminded(key)) continue;
        showNotification(
          reminder.card_title,
          `Due at ${formatDueTime(reminder.due_at)}`,
          key,
        );
        markReminded(key);
      }
    };

    scan(); // evaluate immediately on (re)fetch
    const id = window.setInterval(scan, SCAN_INTERVAL);
    return () => window.clearInterval(id);
  }, [enabled, data]);
}
