import { describe, it, expect } from 'vitest';
import { entrySeconds, formatHoursMinutes, formatHoursMinutesSeconds, totalSeconds } from './timeTracking';
import type { TimeEntry } from '@/types/database';

function entry(startedAt: string, endedAt: string | null): TimeEntry {
  return {
    id: 'e1',
    card_id: 'c1',
    user_id: 'u1',
    started_at: startedAt,
    ended_at: endedAt,
    created_at: startedAt,
  };
}

describe('formatHoursMinutes', () => {
  // Regression test for a real bug report: pausing a timer at 10 seconds
  // showed "0:00" because the old implementation rounded to the nearest
  // minute. It must show the real elapsed seconds instead.
  it('shows seconds precisely under a minute, never rounding a real duration to 0', () => {
    expect(formatHoursMinutes(10)).toBe('0:10');
    expect(formatHoursMinutes(1)).toBe('0:01');
    expect(formatHoursMinutes(0)).toBe('0:00');
  });

  it('shows m:ss under an hour', () => {
    expect(formatHoursMinutes(65)).toBe('1:05');
    expect(formatHoursMinutes(599)).toBe('9:59');
  });

  it('shows h:mm:ss at an hour and beyond', () => {
    expect(formatHoursMinutes(3600)).toBe('1:00:00');
    expect(formatHoursMinutes(3725)).toBe('1:02:05');
  });
});

describe('formatHoursMinutesSeconds', () => {
  it('always includes the hour segment', () => {
    expect(formatHoursMinutesSeconds(10)).toBe('0:00:10');
    expect(formatHoursMinutesSeconds(3725)).toBe('1:02:05');
  });
});

describe('entrySeconds / totalSeconds', () => {
  it('computes elapsed seconds for a running entry relative to now', () => {
    const now = new Date('2026-01-01T00:00:10.000Z');
    const running = entry('2026-01-01T00:00:00.000Z', null);
    expect(entrySeconds(running, now)).toBe(10);
  });

  it('sums multiple entries, including one still running', () => {
    const now = new Date('2026-01-01T00:00:10.000Z');
    const stopped = entry('2025-12-31T23:59:50.000Z', '2026-01-01T00:00:00.000Z');
    const running = entry('2026-01-01T00:00:05.000Z', null);
    expect(totalSeconds([stopped, running], now)).toBe(10 + 5);
  });
});
