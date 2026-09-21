import { parseISO } from 'date-fns';
import type { Card } from '@/types/database';
import { dueAtTime } from '@/lib/dueAt';

/**
 * Layout math for the Day view's hourly time grid (Outlook-style single-day
 * schedule). Cards don't have a stored duration/end time (deliberately not
 * added — see memory.md's Calendar-upgrade entry), so a timed card renders as
 * a fixed-length block at its `due_at` clock time rather than a true
 * start→end span. That's a visual convention, not new data: opening the card
 * still shows its real due date/time, nothing here is persisted.
 */

/** One hour row's pixel height — also used to convert a click's Y offset back
 *  into a clock time for "click an empty slot to create". */
export const ROW_HEIGHT_PX = 56;

/** How many minutes a timed block visually occupies (no real end time to draw). */
export const BLOCK_MINUTES = 45;

/** The grid opens pre-scrolled to this hour, like Outlook's default workday start. */
export const DEFAULT_SCROLL_HOUR = 7;

/** "6 AM" / "12 PM" / "11 PM" for the hour-row gutter. */
export function hourLabel(hour: number): string {
  if (hour === 0) return '12 AM';
  if (hour === 12) return '12 PM';
  return hour < 12 ? `${hour} AM` : `${hour - 12} PM`;
}

/** Minutes since local midnight for a card's `due_at`. */
function minutesOfDay(dueAt: string): number {
  const [h, m] = dueAtTime(dueAt).split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** A day's cards split into the all-day row (no `due_at`) and the timed grid
 *  (has a `due_at` clock time) — mirrors Outlook's all-day banner vs. schedule. */
export function splitTimedCards(cards: Card[]): { allDay: Card[]; timed: Card[] } {
  const allDay: Card[] = [];
  const timed: Card[] = [];
  for (const card of cards) {
    (card.due_at ? timed : allDay).push(card);
  }
  return { allDay, timed };
}

export interface TimedBlock {
  card: Card;
  /** Pixels from the top of the grid. */
  top: number;
  /** Block height in pixels. */
  height: number;
  /** 0-based lane index among overlapping cards. */
  lane: number;
  /** How many lanes this card's overlap cluster occupies (for width %). */
  laneCount: number;
}

interface PlacedCard {
  card: Card;
  start: number;
  lane: number;
  laneCount: number;
}

/**
 * Position every timed card on the hour axis, side-by-side when their blocks
 * overlap — the same "overlap clustering" approach Google/Outlook use: sort by
 * start, greedily assign each card to the first lane free by then, and once a
 * run of mutually-overlapping cards (a cluster) ends, size every card in it to
 * `1 / cluster's lane count` width so they share the row evenly.
 */
export function layoutTimedCards(cards: Card[]): TimedBlock[] {
  const blockHeight = (BLOCK_MINUTES / 60) * ROW_HEIGHT_PX;
  const sorted = [...cards]
    .filter((c) => c.due_at)
    .sort((a, b) => minutesOfDay(a.due_at!) - minutesOfDay(b.due_at!));

  const placed: PlacedCard[] = [];
  let clusterStart = 0; // index into `placed` where the current overlap cluster begins
  let clusterEnd = -Infinity; // latest end time seen in the current cluster
  let laneEnds: number[] = []; // per-lane "free at" time, reset per cluster

  const closeCluster = (uptoExclusive: number) => {
    const laneCount = Math.max(1, laneEnds.length);
    for (let i = clusterStart; i < uptoExclusive; i++) {
      const item = placed[i];
      if (item) item.laneCount = laneCount;
    }
  };

  for (const card of sorted) {
    const start = minutesOfDay(card.due_at!);
    const end = start + BLOCK_MINUTES;

    if (start >= clusterEnd) {
      closeCluster(placed.length);
      clusterStart = placed.length;
      laneEnds = [];
      clusterEnd = -Infinity;
    }

    let lane = laneEnds.findIndex((freeAt) => freeAt <= start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(end);
    } else {
      laneEnds[lane] = end;
    }
    clusterEnd = Math.max(clusterEnd, end);
    placed.push({ card, start, lane, laneCount: 1 });
  }
  closeCluster(placed.length);

  return placed.map((item) => ({
    card: item.card,
    top: (item.start / 60) * ROW_HEIGHT_PX,
    height: blockHeight,
    lane: item.lane,
    laneCount: item.laneCount,
  }));
}

/** Convert a click's pixel offset within the grid into a `HH:mm` clock time,
 *  snapped to the half hour (Outlook's default click-to-create granularity). */
export function clockTimeFromOffset(offsetY: number): string {
  const totalMinutes = Math.max(0, Math.min(23 * 60 + 30, (offsetY / ROW_HEIGHT_PX) * 60));
  const snapped = Math.round(totalMinutes / 30) * 30;
  const hour = Math.floor(snapped / 60);
  const minute = snapped % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

/** Parse a due_at ISO string just to confirm it's valid before formatting —
 *  guards TimeGrid against a malformed value throwing during render. */
export function isValidDueAt(dueAt: string): boolean {
  return !Number.isNaN(parseISO(dueAt).getTime());
}
