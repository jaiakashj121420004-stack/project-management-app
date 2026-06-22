import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import {
  AtSign,
  Bell,
  CheckCheck,
  CheckCircle2,
  Eye,
  Reply,
  RotateCcw,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { springs } from '@/lib/motion';
import type { Notification, NotificationKind } from '@/types/database';
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from './useNotifications';

function payloadString(payload: Record<string, unknown>, key: string): string | undefined {
  const value = payload[key];
  return typeof value === 'string' && value.trim() ? value : undefined;
}

const ICONS: Record<NotificationKind, LucideIcon> = {
  mention: AtSign,
  reply: Reply,
  review_request: Eye,
  review_approved: CheckCircle2,
  review_changes: RotateCcw,
};

function describe(notification: Notification): string {
  const actor = payloadString(notification.payload, 'actor_name') ?? 'Someone';
  const card = payloadString(notification.payload, 'card_title') ?? 'a card';
  switch (notification.kind) {
    case 'mention':
      return `${actor} mentioned you on ${card}`;
    case 'reply':
      return `${actor} replied on ${card}`;
    case 'review_request':
      return `${actor} requested your review on ${card}`;
    case 'review_approved':
      return `${actor} approved ${card}`;
    case 'review_changes':
      return `${actor} requested changes on ${card}`;
    default:
      return `${actor} updated ${card}`;
  }
}

function timeAgo(iso: string): string {
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true });
  } catch {
    return '';
  }
}

/** Topbar bell: unread badge + a dropdown of recent notifications. */
export function NotificationBell() {
  const navigate = useNavigate();
  const { notifications, unreadCount } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  function openNotification(notification: Notification) {
    if (!notification.read_at) markRead.mutate(notification.id);
    const projectId = payloadString(notification.payload, 'project_id');
    setOpen(false);
    if (projectId) void navigate(`/projects/${projectId}`);
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={unreadCount > 0 ? `Notifications (${unreadCount} unread)` : 'Notifications'}
        className="relative grid h-10 w-10 place-items-center rounded-2xl text-fg-muted transition-colors hover:bg-[var(--glass-fill)] hover:text-fg"
      >
        <Bell size={19} />
        {unreadCount > 0 && (
          <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-[linear-gradient(135deg,var(--accent-from),var(--accent-to))] px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, scale: 0.96, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -6 }}
            transition={springs.snappy}
            className="glass-menu absolute right-0 top-12 z-50 w-[min(22rem,calc(100vw-2rem))] origin-top-right rounded-3xl p-2"
          >
            <div className="flex items-center justify-between px-2 py-1.5">
              <span className="text-sm font-semibold text-fg">Notifications</span>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={() => markAll.mutate()}
                  className="inline-flex items-center gap-1 text-xs font-medium text-fg-subtle transition-colors hover:text-fg"
                >
                  <CheckCheck size={13} /> Mark all read
                </button>
              )}
            </div>
            <div className="my-1 h-px bg-[var(--hairline)]" />

            {notifications.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-fg-subtle">You&apos;re all caught up.</p>
            ) : (
              <ul className="max-h-[60vh] overflow-auto">
                {notifications.map((notification) => {
                  const Icon = ICONS[notification.kind] ?? Bell;
                  return (
                    <li key={notification.id}>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => openNotification(notification)}
                        className={cn(
                          'flex w-full items-start gap-2.5 rounded-2xl px-2.5 py-2.5 text-left transition-colors hover:bg-[var(--glass-fill)]',
                          !notification.read_at && 'bg-[var(--accent-from)]/10',
                        )}
                      >
                        <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-xl bg-[var(--glass-fill)] text-[var(--accent-from)]">
                          <Icon size={14} aria-hidden />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm leading-snug text-fg">
                            {describe(notification)}
                          </span>
                          <span className="text-xs text-fg-subtle">
                            {timeAgo(notification.created_at)}
                          </span>
                        </span>
                        {!notification.read_at && (
                          <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[var(--accent-from)]" />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
