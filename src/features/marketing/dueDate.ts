import { addDays, format, startOfToday } from 'date-fns';

/**
 * Turn a relative "days from today" offset into the `YYYY-MM-DD` string the real
 * card components expect, so faux due-date pills color themselves (overdue /
 * soon / upcoming) exactly like live cards regardless of when the page loads.
 */
export function isoFromOffset(days: number): string {
  return format(addDays(startOfToday(), days), 'yyyy-MM-dd');
}
