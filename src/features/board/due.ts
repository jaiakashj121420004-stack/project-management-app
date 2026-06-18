import { differenceInCalendarDays, format, parseISO, startOfToday } from 'date-fns';

/**
 * Due-date urgency for a card. Drives the pill color on the card face and the
 * board's due-status filter (plan.md §4.2: due-soon = warning, overdue =
 * danger). Dates are stored as `YYYY-MM-DD` (no time), so all math is in whole
 * calendar days relative to the local "today".
 */
export type DueStatus = 'overdue' | 'soon' | 'upcoming';

/** Whole calendar days from today to the due date (negative = in the past). */
function daysUntil(dueIso: string): number {
  return differenceInCalendarDays(parseISO(dueIso), startOfToday());
}

export function dueStatus(dueIso: string): DueStatus {
  const days = daysUntil(dueIso);
  if (days < 0) return 'overdue';
  if (days <= 2) return 'soon';
  return 'upcoming';
}

export function isOverdue(dueIso: string): boolean {
  return daysUntil(dueIso) < 0;
}

/** Due today through the next 7 days — the board's "due this week" filter. */
export function isDueThisWeek(dueIso: string): boolean {
  const days = daysUntil(dueIso);
  return days >= 0 && days <= 7;
}

/** Compact, human due label: Today / Tomorrow / Yesterday / "Jun 24". */
export function formatDueLabel(dueIso: string): string {
  const days = daysUntil(dueIso);
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days === -1) return 'Yesterday';
  return format(parseISO(dueIso), 'MMM d');
}
