import {
  addDays,
  addMonths,
  addWeeks,
  differenceInCalendarDays,
  getDate,
  getDay,
  isLastDayOfMonth,
  parseISO,
} from 'date-fns';

/**
 * A to-do list's repeat schedule (stored as `todo_recurrences.rule`, jsonb).
 * "daily" is the free tier's only option — it's exactly the old "repeat every
 * day" toggle. The other three are Pro (enforced both here in the UI and by
 * the `enforce_recurrence_plan` DB trigger, never trust the client alone):
 *   - weekly:   only on the chosen weekdays (e.g. Mon/Wed/Fri)
 *   - monthly:  a fixed day of the month, or the LAST day of every month
 *   - interval: every N days / weeks / months, counted from an anchor date
 */
export type RecurrenceRule =
  | { type: 'daily' }
  | { type: 'weekly'; weekdays: number[] } // 0 = Sunday … 6 = Saturday
  | { type: 'monthly'; day: number | 'last' } // 1–31, or the month's last day
  | { type: 'interval'; unit: 'day' | 'week' | 'month'; count: number; anchor: string }; // anchor = YYYY-MM-DD

export const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const;
export const WEEKDAY_FULL_LABELS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

/** True when a Free plan may use this rule (only the plain daily repeat). */
export function isFreeRule(rule: RecurrenceRule): boolean {
  return rule.type === 'daily';
}

/**
 * Does `rule` fire on `dateKey` (a local YYYY-MM-DD)? Pure date math, no
 * timezone conversion — everything is compared as calendar dates so a rule
 * behaves the same regardless of the browser's timezone.
 */
export function ruleMatchesDate(rule: RecurrenceRule, dateKey: string): boolean {
  const date = parseISO(dateKey);
  switch (rule.type) {
    case 'daily':
      return true;

    case 'weekly':
      return rule.weekdays.includes(getDay(date));

    case 'monthly': {
      if (rule.day === 'last') return isLastDayOfMonth(date);
      // A day like 31 simply never fires in a 30-day month — no clamping
      // surprises. (Common, well-understood monthly-recurrence behaviour.)
      return getDate(date) === rule.day;
    }

    case 'interval': {
      const anchor = parseISO(rule.anchor);
      if (date < anchor) return false;
      if (rule.unit === 'day') {
        return differenceInCalendarDays(date, anchor) % rule.count === 0;
      }
      if (rule.unit === 'week') {
        // Match the same weekday as the anchor, every `count` weeks.
        if (getDay(date) !== getDay(anchor)) return false;
        const weeks = Math.round(differenceInCalendarDays(date, anchor) / 7);
        return weeks % rule.count === 0;
      }
      // 'month': match the same day-of-month as the anchor, every `count`
      // months (walking forward from the anchor so short months don't skew
      // the cadence — e.g. anchor Jan 31 lands on the last day of Feb/Apr/…).
      let cursor = anchor;
      let guard = 0;
      while (cursor < date && guard < 1200) {
        cursor = addMonths(cursor, rule.count);
        guard++;
      }
      return differenceInCalendarDays(cursor, date) === 0;
    }

    default:
      return false;
  }
}

/** Short, human summary shown in the recurrence editor and list card. */
export function describeRule(rule: RecurrenceRule): string {
  switch (rule.type) {
    case 'daily':
      return 'Every day';
    case 'weekly': {
      if (rule.weekdays.length === 7) return 'Every day';
      if (rule.weekdays.length === 0) return 'Never (pick a day)';
      const sorted = [...rule.weekdays].sort((a, b) => a - b);
      return `Every ${sorted.map((d) => WEEKDAY_FULL_LABELS[d]).join(', ')}`;
    }
    case 'monthly':
      return rule.day === 'last' ? 'Last day of every month' : `Day ${rule.day} of every month`;
    case 'interval': {
      const unit = rule.unit === 'day' ? 'day' : rule.unit === 'week' ? 'week' : 'month';
      return rule.count === 1 ? `Every ${unit}` : `Every ${rule.count} ${unit}s`;
    }
    default:
      return 'Custom';
  }
}

/** Sensible defaults when a user switches the segmented "repeat type" control. */
export function defaultRuleFor(type: RecurrenceRule['type'], todayKey: string): RecurrenceRule {
  switch (type) {
    case 'daily':
      return { type: 'daily' };
    case 'weekly':
      return { type: 'weekly', weekdays: [getDay(parseISO(todayKey))] };
    case 'monthly':
      return { type: 'monthly', day: getDate(parseISO(todayKey)) };
    case 'interval':
      return { type: 'interval', unit: 'week', count: 2, anchor: todayKey };
  }
}

// Re-exported so callers building anchor-relative previews don't need their
// own date-fns imports for the common cases.
export { addDays, addWeeks, addMonths };
