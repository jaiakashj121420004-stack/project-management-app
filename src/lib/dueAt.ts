import { format, parseISO } from 'date-fns';

/**
 * Helpers for `cards.due_at` (a full timestamptz) vs `cards.due_date` (a bare
 * YYYY-MM-DD). due_at is the source of truth for *when* a card is due and what
 * Pro timed reminders measure against; due_date stays the value the board and
 * calendar group by. These convert between an absolute due_at instant and the
 * local date + time the user actually picks in the card modal.
 *
 * Timezone: a due_at is an absolute instant (stored UTC). We build it from the
 * user's LOCAL date+time (`combineDueAt`) and render it back in LOCAL time
 * (`dueAtTime`/`dueAtDate`), so "due 2:30pm" means 2:30pm where the user is.
 * Comparisons against `now()` are instant-vs-instant and so timezone-correct on
 * both the browser and the (UTC) server.
 */

/** Local `HH:mm` of a due_at ISO timestamp (for the time input). */
export function dueAtTime(iso: string): string {
  return format(parseISO(iso), 'HH:mm');
}

/** Local `YYYY-MM-DD` of a due_at ISO timestamp (for the date input). */
export function dueAtDate(iso: string): string {
  return format(parseISO(iso), 'yyyy-MM-dd');
}

/** Local, human time label for a due_at, e.g. "2:30 PM". */
export function formatDueTime(iso: string): string {
  return format(parseISO(iso), 'h:mm a');
}

/** Matches a 24-hour `HH:mm` time string. */
export const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Combine a local date (`YYYY-MM-DD`) + time (`HH:mm`) into a due_at ISO instant.
 * Returns null when either part is missing — a due_at only exists once the user
 * has chosen a specific time (otherwise the card stays day-based). An invalid
 * time falls back to 09:00 so a malformed value can never throw.
 */
export function combineDueAt(date: string | null, time: string | null): string | null {
  if (!date || !time) return null;
  const safeTime = TIME_RE.test(time) ? time : '09:00';
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = safeTime.split(':').map(Number);
  if (
    year === undefined ||
    month === undefined ||
    day === undefined ||
    hour === undefined ||
    minute === undefined ||
    [year, month, day, hour, minute].some(Number.isNaN)
  ) {
    return null;
  }
  // Constructed in local time; toISOString() yields the matching UTC instant.
  return new Date(year, month - 1, day, hour, minute, 0, 0).toISOString();
}
