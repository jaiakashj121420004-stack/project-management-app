import type { TimeEntry } from '@/types/database';

/**
 * Duration math + formatting for per-card time tracking (plan.md §5). Entries
 * with `ended_at === null` are "currently running" (the same nullable-sentinel
 * pattern as `cards.due_at`) — every helper here takes `now` explicitly so a
 * live-ticking display (TimeTrackingSection.tsx) can recompute on an interval without
 * re-deriving the sentinel logic at each call site.
 */

/** Seconds elapsed for one entry, relative to `now` when still running. */
export function entrySeconds(entry: TimeEntry, now: Date): number {
  const started = new Date(entry.started_at).getTime();
  const ended = entry.ended_at ? new Date(entry.ended_at).getTime() : now.getTime();
  return Math.max(0, Math.floor((ended - started) / 1000));
}

/** Sum of every entry's elapsed time, in seconds — the card's running total. */
export function totalSeconds(entries: TimeEntry[], now: Date): number {
  return entries.reduce((sum, entry) => sum + entrySeconds(entry, now), 0);
}

/**
 * Compact running-total duration — "m:ss" under an hour, "h:mm:ss" once it
 * crosses one. Always exact (no minute-level rounding): the previous
 * "h:mm" format rounded to the nearest minute, so pausing at 10s displayed
 * as "0:00" — indistinguishable from no time tracked at all. Anything under
 * a minute must still show its real seconds.
 */
export function formatHoursMinutes(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const hours = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hours > 0) {
    return `${hours}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

/** "h:mm:ss" — the live-ticking format shown while a timer is running. */
export function formatHoursMinutesSeconds(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${hours}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/** The current user's running entry on this card, if any — drives the
 *  start/stop button's state. A user can have at most one running entry across
 *  the whole account (DB-enforced, time_entries_one_running_per_user), so this
 *  is also implicitly "is MY timer running, and is it running HERE." */
export function runningEntryFor(
  entries: TimeEntry[],
  userId: string,
  cardId: string,
): TimeEntry | undefined {
  return entries.find(
    (entry) => entry.card_id === cardId && entry.user_id === userId && entry.ended_at === null,
  );
}
