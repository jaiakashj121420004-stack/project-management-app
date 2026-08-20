import { differenceInCalendarDays, parseISO } from 'date-fns';
import type { Card, Project } from '@/types/database';
import { toDateKey } from './dates';

/**
 * Layout math for the Timeline/Gantt view (Task 25) — a new lens on the same
 * due-date data Calendar already shows, not a new data source. No task
 * dependencies/critical path, resource leveling, or baseline/variance
 * tracking here by deliberate scope cut (see memory.md's Task 25 entry).
 */

/**
 * A card's effective bar start. `start_date` is optional (see
 * 20260820130000_card_start_date.sql) — a card with only a due_date renders
 * as a single-day bar (effective start === due_date) rather than forcing a
 * two-date setup before it's useful. Dragging a bar's start handle sets
 * `start_date` explicitly, turning the marker into a real range.
 */
export function effectiveStartDate(card: Card): string {
  return card.start_date ?? card.due_date ?? '';
}

/** Group dated cards by project, each group sorted by bar start then title —
 *  the Timeline's row order. Cards without a due_date never reach here (the
 *  same `['calendar-cards']` query Calendar itself uses already excludes them). */
export function groupCardsByProject(cards: Card[]): Map<string, Card[]> {
  const map = new Map<string, Card[]>();
  for (const card of cards) {
    if (!card.due_date) continue;
    const list = map.get(card.project_id) ?? [];
    list.push(card);
    map.set(card.project_id, list);
  }
  for (const list of map.values()) {
    list.sort((a, b) => effectiveStartDate(a).localeCompare(effectiveStartDate(b)) || a.title.localeCompare(b.title));
  }
  return map;
}

/** Projects that actually have a bar to show, in the Timeline's row order —
 *  matching the "useful the moment you open it" default: no empty rows for
 *  projects with nothing scheduled this month. */
export function projectsWithBars(projects: Project[], cardsByProject: Map<string, Card[]>): Project[] {
  return projects.filter((project) => (cardsByProject.get(project.id) ?? []).length > 0);
}

export interface BarSpan {
  /** 0-based column index of the bar's first visible day. */
  startCol: number;
  /** 0-based column index of the bar's last visible day (inclusive). */
  endCol: number;
}

/**
 * A card's bar clipped to the visible day range, as 0-based column indices
 * into `days` (for a CSS grid `gridColumn`). Returns null if the bar falls
 * entirely outside the visible month (e.g. a card due next month, mid-drag).
 */
export function barSpan(card: Card, days: Date[]): BarSpan | null {
  if (days.length === 0 || !card.due_date) return null;
  const axisStart = days[0]!;
  const startIdx = differenceInCalendarDays(parseISO(effectiveStartDate(card)), axisStart);
  const endIdx = differenceInCalendarDays(parseISO(card.due_date), axisStart);
  const startCol = Math.max(0, Math.min(startIdx, endIdx));
  const endCol = Math.min(days.length - 1, Math.max(startIdx, endIdx));
  if (endCol < 0 || startCol > days.length - 1) return null;
  return { startCol, endCol };
}

/** Whether a bar's start is clipped off the left edge of the visible range
 *  (the card actually starts before this month) — drives a "continues
 *  earlier" affordance instead of a false start-handle position. */
export function isClippedStart(card: Card, days: Date[]): boolean {
  if (days.length === 0) return false;
  return parseISO(effectiveStartDate(card)) < days[0]!;
}

/** Whether a bar's end is clipped off the right edge of the visible range. */
export function isClippedEnd(card: Card, days: Date[]): boolean {
  if (days.length === 0 || !card.due_date) return false;
  return parseISO(card.due_date) > days[days.length - 1]!;
}

/** Shift a date key by a number of days, returning a new `YYYY-MM-DD` key. */
export function shiftDateKey(dateKey: string, deltaDays: number): string {
  const d = parseISO(dateKey);
  d.setDate(d.getDate() + deltaDays);
  return toDateKey(d);
}
