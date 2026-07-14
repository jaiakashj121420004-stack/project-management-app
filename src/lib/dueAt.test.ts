import { describe, it, expect } from 'vitest';
import {
  TIME_RE,
  combineDueAt,
  dueAtDate,
  dueAtTime,
  formatClockTime,
  formatDueTime,
} from './dueAt';

describe('TIME_RE', () => {
  it('accepts valid 24-hour HH:mm strings', () => {
    for (const t of ['00:00', '09:00', '13:45', '23:59']) {
      expect(TIME_RE.test(t)).toBe(true);
    }
  });

  it('rejects malformed times', () => {
    for (const t of ['24:00', '9:00', '13:60', '1345', '', 'ab:cd']) {
      expect(TIME_RE.test(t)).toBe(false);
    }
  });
});

describe('combineDueAt', () => {
  it('returns null when either the date or time is missing', () => {
    expect(combineDueAt(null, '09:00')).toBeNull();
    expect(combineDueAt('2026-07-14', null)).toBeNull();
    expect(combineDueAt(null, null)).toBeNull();
  });

  it('produces an ISO instant that round-trips back to the same local date+time', () => {
    const iso = combineDueAt('2026-07-14', '14:30');
    expect(iso).not.toBeNull();
    // dueAtDate/dueAtTime read back in the SAME local zone the instant was built
    // from, so this round-trip is timezone-independent.
    expect(dueAtDate(iso as string)).toBe('2026-07-14');
    expect(dueAtTime(iso as string)).toBe('14:30');
  });

  it('falls back to 09:00 for an invalid time rather than throwing', () => {
    const iso = combineDueAt('2026-07-14', '25:99');
    expect(iso).not.toBeNull();
    expect(dueAtTime(iso as string)).toBe('09:00');
  });

  it('is a valid parseable ISO timestamp', () => {
    const iso = combineDueAt('2026-01-05', '08:15') as string;
    expect(Number.isNaN(Date.parse(iso))).toBe(false);
  });
});

describe('formatClockTime', () => {
  it('renders a 24-hour HH:mm as a 12-hour label', () => {
    expect(formatClockTime('14:30')).toBe('2:30 PM');
    expect(formatClockTime('00:00')).toBe('12:00 AM');
    expect(formatClockTime('09:05')).toBe('9:05 AM');
  });
});

describe('formatDueTime', () => {
  it('renders a due_at ISO instant as a local 12-hour label', () => {
    const iso = combineDueAt('2026-07-14', '14:30') as string;
    expect(formatDueTime(iso)).toBe('2:30 PM');
  });
});
