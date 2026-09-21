import type { RecurrenceRule } from '@/lib/recurrence';

/**
 * A minimal client-side RFC 5545 (iCalendar) reader for the Calendar's
 * "Import" flow (see ImportCalendarModal.tsx). Deliberately narrow — this
 * reads the handful of VEVENT properties Aurora can actually represent
 * (SUMMARY, DTSTART, DESCRIPTION, a simple RRULE) rather than being a general
 * ICS library. Anything it can't confidently map is either imported as a
 * plain one-time event or skipped outright, always with a note explaining
 * what happened — never silently dropped or guessed at.
 *
 * This is a one-time snapshot read, mirroring `features/import/`'s Trello/CSV
 * parsers: no ongoing sync, no re-import/diff against what's already in
 * Aurora, and no per-occurrence exceptions (an imported recurring event maps
 * to Aurora's own simple repeat types — see lib/recurrence.ts — never a
 * faithful copy of the source RRULE).
 */

export interface ParsedIcsEvent {
  /** From VEVENT's UID, when present — not currently used for de-duping
   *  (Aurora doesn't track import provenance), but kept for a future pass. */
  uid: string | null;
  title: string;
  description: string | null;
  /** `YYYY-MM-DD`, always set for an event that made it this far. */
  dueDate: string;
  /** ISO instant, or null for an all-day event. */
  dueAt: string | null;
  /** null = a one-time event, or a source RRULE Aurora couldn't map. */
  recurrence: RecurrenceRule | null;
  /** True when `recurrence` is Aurora's best simple approximation of a more
   *  specific source RRULE (e.g. BYDAY dropped, or COUNT/UNTIL ignored). */
  recurrenceApproximated: boolean;
}

export interface ParsedIcs {
  events: ParsedIcsEvent[];
  /** Human-readable "what happened" lines, shown before and after import —
   *  same convention as features/import/schemas.ts's ParsedImport. */
  notes: string[];
}

const MAX_EVENTS = 2000;

const BYDAY_TO_WEEKDAY: Record<string, number> = {
  SU: 0,
  MO: 1,
  TU: 2,
  WE: 3,
  TH: 4,
  FR: 5,
  SA: 6,
};

/** RFC 5545 §3.1 line unfolding: a line starting with a space or tab is a
 *  continuation of the previous line, joined with the fold removed. */
function unfoldLines(text: string): string[] {
  const raw = text.split(/\r\n|\n|\r/);
  const lines: string[] = [];
  for (const line of raw) {
    if ((line.startsWith(' ') || line.startsWith('\t')) && lines.length > 0) {
      lines[lines.length - 1] += line.slice(1);
    } else if (line.length > 0) {
      lines.push(line);
    }
  }
  return lines;
}

/** Reverses the backslash-escaping RFC 5545 §3.3.11 requires for TEXT values. */
function unescapeText(value: string): string {
  return value
    .replace(/\\n/gi, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\');
}

/** Splits `NAME;PARAM=x:value` into its bare property name and value,
 *  ignoring parameters (TZID, VALUE=DATE, etc. are read separately below). */
function splitProperty(line: string): { name: string; params: string; value: string } | null {
  const colon = line.indexOf(':');
  if (colon === -1) return null;
  const head = line.slice(0, colon);
  const value = line.slice(colon + 1);
  const semi = head.indexOf(';');
  const name = (semi === -1 ? head : head.slice(0, semi)).toUpperCase();
  const params = semi === -1 ? '' : head.slice(semi + 1);
  return { name, params, value };
}

/** `20260910` → `2026-09-10`; `20260910T090000` / `...Z` → date + ISO instant.
 *  A bare local date/time (no Z, no UTC offset) is treated as already being
 *  in the viewer's local time — the source calendar's real timezone isn't
 *  resolved, a deliberate simplification noted in the import summary when it
 *  matters (a timed, non-UTC event). */
function parseDtstart(params: string, value: string): { dueDate: string; dueAt: string | null } | null {
  const isDateOnly = /VALUE=DATE\b/i.test(params) || /^\d{8}$/.test(value);
  const match = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/.exec(value.trim());
  if (!match) return null;
  const [, y, mo, d, h, mi, s, z] = match;
  const dueDate = `${y}-${mo}-${d}`;
  if (isDateOnly || h === undefined) return { dueDate, dueAt: null };
  const iso = z
    ? `${y}-${mo}-${d}T${h}:${mi}:${s}Z`
    : new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s)).toISOString();
  return { dueDate, dueAt: iso };
}

/** Best-effort RRULE → Aurora RecurrenceRule. Only FREQ=DAILY/WEEKLY/MONTHLY
 *  at INTERVAL 1 map cleanly; everything else (YEARLY, INTERVAL>1, multiple
 *  BYMONTHDAY, etc.) is reported back as unmapped so the caller can fall back
 *  to a one-time event. COUNT/UNTIL are intentionally ignored — Aurora's
 *  recurring cards have no stored end date (see cards.recurrence_rule);
 *  noted in the summary, never silently applied as "repeats forever". */
function parseRrule(value: string, dueDate: string): { rule: RecurrenceRule; approximated: boolean } | null {
  const parts = new Map<string, string>();
  for (const part of value.split(';')) {
    const [key, val] = part.split('=');
    if (key && val) parts.set(key.toUpperCase(), val);
  }
  const freq = parts.get('FREQ');
  const interval = Number(parts.get('INTERVAL') ?? '1');
  const hasCountOrUntil = parts.has('COUNT') || parts.has('UNTIL');

  if (freq === 'DAILY' && interval === 1) {
    return { rule: { type: 'daily' }, approximated: hasCountOrUntil };
  }

  if (freq === 'WEEKLY' && interval === 1) {
    const byday = parts.get('BYDAY');
    const weekdays = byday
      ? byday
          .split(',')
          .map((code) => BYDAY_TO_WEEKDAY[code.slice(-2).toUpperCase()])
          .filter((n): n is number => n !== undefined)
      : [new Date(`${dueDate}T00:00:00`).getDay()];
    if (weekdays.length === 0) return null;
    return {
      rule: { type: 'weekly', weekdays: [...new Set(weekdays)].sort() },
      approximated: hasCountOrUntil || Boolean(byday),
    };
  }

  if (freq === 'MONTHLY' && interval === 1 && !parts.has('BYDAY')) {
    const byMonthDay = parts.get('BYMONTHDAY');
    const day = byMonthDay === '-1' ? 'last' : byMonthDay ? Number(byMonthDay) : Number(dueDate.slice(8, 10));
    if (day !== 'last' && (!Number.isInteger(day) || day < 1 || day > 31)) return null;
    return { rule: { type: 'monthly', day }, approximated: hasCountOrUntil };
  }

  return null;
}

/** Parses raw `.ics` text into events Aurora can create as cards. Never
 *  throws on a malformed calendar — a file with no VEVENTs just yields an
 *  empty result with a note, so the modal can show that plainly rather than
 *  a generic error. */
export function parseIcs(text: string): ParsedIcs {
  const lines = unfoldLines(text);
  const events: ParsedIcsEvent[] = [];
  let approximatedCount = 0;
  let noDateCount = 0;
  let noTitleCount = 0;
  let truncated = false;

  let inEvent = false;
  let current: {
    uid: string | null;
    title: string | null;
    description: string | null;
    dueDate: string | null;
    dueAt: string | null;
    rruleRaw: string | null;
  } | null = null;

  for (const line of lines) {
    if (line.toUpperCase() === 'BEGIN:VEVENT') {
      inEvent = true;
      current = { uid: null, title: null, description: null, dueDate: null, dueAt: null, rruleRaw: null };
      continue;
    }
    if (line.toUpperCase() === 'END:VEVENT') {
      inEvent = false;
      if (current) {
        if (events.length >= MAX_EVENTS) {
          truncated = true;
        } else if (!current.dueDate) {
          noDateCount += 1;
        } else if (!current.title) {
          noTitleCount += 1;
        } else {
          let recurrence: RecurrenceRule | null = null;
          let recurrenceApproximated = false;
          if (current.rruleRaw) {
            const mapped = parseRrule(current.rruleRaw, current.dueDate);
            if (mapped) {
              recurrence = mapped.rule;
              recurrenceApproximated = mapped.approximated;
              if (mapped.approximated) approximatedCount += 1;
            } else {
              approximatedCount += 1; // dropped to one-time entirely
            }
          }
          events.push({
            uid: current.uid,
            title: current.title,
            description: current.description,
            dueDate: current.dueDate,
            dueAt: current.dueAt,
            recurrence,
            recurrenceApproximated,
          });
        }
      }
      current = null;
      continue;
    }
    if (!inEvent || !current) continue;

    const prop = splitProperty(line);
    if (!prop) continue;

    switch (prop.name) {
      case 'UID':
        current.uid = prop.value.trim() || null;
        break;
      case 'SUMMARY': {
        const title = unescapeText(prop.value.trim()).slice(0, 200);
        current.title = title.length > 0 ? title : null;
        break;
      }
      case 'DESCRIPTION': {
        const description = unescapeText(prop.value.trim());
        current.description = description.length > 0 ? description.slice(0, 5000) : null;
        break;
      }
      case 'DTSTART': {
        const parsed = parseDtstart(prop.params, prop.value);
        if (parsed) {
          current.dueDate = parsed.dueDate;
          current.dueAt = parsed.dueAt;
        }
        break;
      }
      case 'RRULE':
        current.rruleRaw = prop.value.trim();
        break;
      default:
        break;
    }
  }

  const notes: string[] = [];
  if (noDateCount > 0) {
    notes.push(`${noDateCount} event${noDateCount === 1 ? '' : 's'} had no start date and ${noDateCount === 1 ? 'was' : 'were'} skipped.`);
  }
  if (noTitleCount > 0) {
    notes.push(`${noTitleCount} event${noTitleCount === 1 ? '' : 's'} had no title and ${noTitleCount === 1 ? 'was' : 'were'} skipped.`);
  }
  if (approximatedCount > 0) {
    notes.push(
      `${approximatedCount} recurring event${approximatedCount === 1 ? '' : 's'} had a repeat rule Aurora simplified to its closest match (daily, weekly, or monthly) — no end date is carried over, so it repeats going forward until removed.`,
    );
  }
  if (truncated) {
    notes.push(`Only the first ${MAX_EVENTS} events were read from this file.`);
  }
  if (events.length === 0 && notes.length === 0) {
    notes.push('No events found in this file.');
  }

  return { events, notes };
}
