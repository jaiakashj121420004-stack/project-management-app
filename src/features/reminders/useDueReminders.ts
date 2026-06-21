import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useProfile } from '@/features/auth/useProfile';
import { formatDueLabel } from '@/features/board/due';
import { fetchMyDueSoonCards } from './api';
import {
  alreadyReminded,
  markReminded,
  notificationPermission,
  reminderKey,
  showDueNotification,
  useBrowserRemindersPref,
} from './notifications';

const POLL_INTERVAL = 1000 * 60 * 30; // re-check every 30 minutes

/** Phrase the due date for a notification body: "due today" / "due on Jun 24". */
function dueText(dueIso: string): string {
  const label = formatDueLabel(dueIso);
  return label === 'Today' || label === 'Tomorrow'
    ? `due ${label.toLowerCase()}`
    : `due on ${label}`;
}

/**
 * App-wide in-app due-date reminders (Phase 9). When the user has opted in
 * (Profile → Reminders) AND granted notification permission AND is online, this
 * polls for their due-soon assigned cards and fires a browser notification once
 * per card+due-date (deduped in localStorage). Mounted once in AppShell.
 */
export function useDueReminders(): void {
  const { user } = useAuth();
  const online = useOnlineStatus();
  const prefEnabled = useBrowserRemindersPref();
  const { data: profile } = useProfile();

  const leadDays = profile?.reminder_lead_days ?? 1;
  const enabled =
    Boolean(user) && online && prefEnabled && notificationPermission() === 'granted';

  const { data } = useQuery({
    queryKey: ['due-reminders', user?.id, leadDays],
    enabled,
    queryFn: () => fetchMyDueSoonCards(user!.id, leadDays),
    refetchInterval: POLL_INTERVAL,
    refetchOnWindowFocus: true,
    staleTime: POLL_INTERVAL,
  });

  useEffect(() => {
    if (!enabled || !data) return;
    for (const card of data) {
      if (!card.due_date) continue;
      const key = reminderKey(card);
      if (alreadyReminded(key)) continue;
      showDueNotification(card, dueText(card.due_date));
      markReminded(key);
    }
  }, [enabled, data]);
}
