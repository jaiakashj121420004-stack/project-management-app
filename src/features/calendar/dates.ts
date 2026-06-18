import {
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import type { Card } from '@/types/database';

/**
 * Date math for the Calendar view, built on date-fns — no heavy calendar
 * dependency. Cards store `due_date` as a `YYYY-MM-DD` string (no time); we key
 * everything off that same string, produced locally by `toDateKey`, so a card
 * lands on the exact day it was set to regardless of timezone.
 */
export type CalendarView = 'month' | 'week';

/** Column headers, starting Sunday (date-fns default week start). */
export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

/** Local `YYYY-MM-DD` key for a day — matches how `cards.due_date` is stored. */
export function toDateKey(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

/** The full weeks (incl. trailing/leading days) covering `cursor`'s month. */
export function monthDays(cursor: Date): Date[] {
  return eachDayOfInterval({
    start: startOfWeek(startOfMonth(cursor)),
    end: endOfWeek(endOfMonth(cursor)),
  });
}

/** The seven days of the week containing `cursor`. */
export function weekDays(cursor: Date): Date[] {
  return eachDayOfInterval({ start: startOfWeek(cursor), end: endOfWeek(cursor) });
}

/** Days to render for the active view. */
export function calendarDays(view: CalendarView, cursor: Date): Date[] {
  return view === 'month' ? monthDays(cursor) : weekDays(cursor);
}

/** Human label for the current period, e.g. "June 2026" or "Jun 15 – 21, 2026". */
export function periodLabel(view: CalendarView, cursor: Date): string {
  if (view === 'month') return format(cursor, 'MMMM yyyy');
  const start = startOfWeek(cursor);
  const end = endOfWeek(cursor);
  return isSameMonth(start, end)
    ? `${format(start, 'MMM d')} – ${format(end, 'd, yyyy')}`
    : `${format(start, 'MMM d')} – ${format(end, 'MMM d, yyyy')}`;
}

/** Group dated cards by their `due_date` key, ordered within a day. */
export function groupCardsByDate(cards: Card[]): Map<string, Card[]> {
  const map = new Map<string, Card[]>();
  for (const card of cards) {
    if (!card.due_date) continue;
    const list = map.get(card.due_date) ?? [];
    list.push(card);
    map.set(card.due_date, list);
  }
  for (const list of map.values()) {
    list.sort((a, b) => a.position - b.position || a.title.localeCompare(b.title));
  }
  return map;
}
