import { useSyncExternalStore } from 'react';
import type { Card } from '@/types/database';

/**
 * Browser-notification plumbing for in-app due-date reminders (Phase 9, the
 * zero-setup half of "Both"). These fire while the app is open/installed; the
 * reliable, works-when-closed path is the email Edge Function. Pure helpers —
 * no React except the small reactive preference hook at the bottom.
 */

const ENABLED_KEY = 'aurora-browser-reminders';
const DEDUPE_KEY = 'aurora-reminded';
const CHANGE_EVENT = 'aurora-reminders-changed';
const DEDUPE_TTL = 1000 * 60 * 60 * 24 * 45; // prune entries older than 45 days

export function browserNotificationsSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function notificationPermission(): NotificationPermission | 'unsupported' {
  return browserNotificationsSupported() ? Notification.permission : 'unsupported';
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!browserNotificationsSupported()) return 'denied';
  const result = await Notification.requestPermission();
  window.dispatchEvent(new Event(CHANGE_EVENT));
  return result;
}

// --- enabled preference (reactive across the app) ---------------------------

export function browserRemindersEnabled(): boolean {
  try {
    return localStorage.getItem(ENABLED_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setBrowserRemindersEnabled(enabled: boolean): void {
  localStorage.setItem(ENABLED_KEY, enabled ? 'true' : 'false');
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function subscribePref(callback: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, callback);
  window.addEventListener('storage', callback);
  return () => {
    window.removeEventListener(CHANGE_EVENT, callback);
    window.removeEventListener('storage', callback);
  };
}

/** Reactive read of the "browser reminders on?" preference (re-renders on toggle). */
export function useBrowserRemindersPref(): boolean {
  return useSyncExternalStore(subscribePref, browserRemindersEnabled, () => false);
}

// --- de-duplication ---------------------------------------------------------

function readReminded(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(DEDUPE_KEY) ?? '{}') as Record<string, number>;
  } catch {
    return {};
  }
}

/** Have we already shown a notification for this card+due-date? Prunes stale keys. */
export function alreadyReminded(key: string): boolean {
  return key in readReminded();
}

export function markReminded(key: string): void {
  const now = Date.now();
  const map = readReminded();
  map[key] = now;
  for (const [k, ts] of Object.entries(map)) {
    if (now - ts > DEDUPE_TTL) delete map[k];
  }
  localStorage.setItem(DEDUPE_KEY, JSON.stringify(map));
}

/** Stable per-card+due-date key, so re-scheduling a card re-arms its reminder. */
export function reminderKey(card: Pick<Card, 'id' | 'due_date'>): string {
  return `${card.id}:${card.due_date ?? ''}`;
}

// --- showing ----------------------------------------------------------------

/** Low-level: show one browser notification (no-op without permission). */
export function showNotification(title: string, body: string, tag: string): void {
  if (notificationPermission() !== 'granted') return;
  new Notification(title, {
    body,
    tag, // OS-level dedupe too
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
  });
}

export function showDueNotification(card: Card, dueText: string): void {
  showNotification(card.title, `Task ${dueText}`, reminderKey(card));
}
