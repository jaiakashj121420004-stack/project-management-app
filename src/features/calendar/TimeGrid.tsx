import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { cn } from '@/lib/cn';
import type { AccentName } from '@/lib/accents';
import type { Card } from '@/types/database';
import { CardChip } from './CardChip';
import {
  DEFAULT_SCROLL_HOUR,
  ROW_HEIGHT_PX,
  clockTimeFromOffset,
  hourLabel,
  layoutTimedCards,
} from './dayGrid';

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const GUTTER = 56; // px — matches `w-14`, kept as a number for the schedule column's `left`

interface TimeGridProps {
  /** Only cards with a `due_at` clock time — the all-day row is rendered by the caller. */
  cards: Card[];
  accentFor: (projectId: string) => AccentName;
  onOpenCard: (card: Card) => void;
  /** Fired with an `HH:mm` clock time when an empty slot is clicked. */
  onSlotClick: (time: string) => void;
  /** Draws the live "now" line — only meaningful when this grid is showing today. */
  showNowLine?: boolean;
}

/**
 * Outlook-style hourly schedule for the Day view: a scrollable 24-hour axis
 * with timed cards positioned at their clock time (see dayGrid.ts for the
 * layout math — no stored duration, so blocks are a fixed visual length).
 * Clicking any empty slot opens the quick-add popover pre-filled with that
 * time; clicking a card opens the normal card detail modal instead.
 */
export function TimeGrid({ cards, accentFor, onOpenCard, onSlotClick, showNowLine = false }: TimeGridProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const blocks = useMemo(() => layoutTimedCards(cards), [cards]);
  const [nowMinutes, setNowMinutes] = useState(() => minutesSinceMidnight());

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: Math.max(0, (DEFAULT_SCROLL_HOUR - 1) * ROW_HEIGHT_PX) });
  }, []);

  useEffect(() => {
    if (!showNowLine) return;
    const id = window.setInterval(() => setNowMinutes(minutesSinceMidnight()), 60_000);
    return () => window.clearInterval(id);
  }, [showNowLine]);

  function handleSlotClick(event: ReactMouseEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    onSlotClick(clockTimeFromOffset(event.clientY - rect.top));
  }

  return (
    <div
      ref={scrollRef}
      className="max-h-[32rem] overflow-y-auto rounded-xl border border-[var(--glass-border)]"
    >
      <div className="relative" style={{ height: 24 * ROW_HEIGHT_PX }}>
        {HOURS.map((hour) => (
          <div
            key={hour}
            aria-hidden
            className="absolute inset-x-0 border-t border-[var(--glass-border)]/60"
            style={{ top: hour * ROW_HEIGHT_PX }}
          >
            <span className="absolute -top-2 left-1 w-12 text-right text-[0.65rem] font-medium text-fg-subtle">
              {hourLabel(hour)}
            </span>
          </div>
        ))}

        <div
          className="absolute inset-y-0 right-0 cursor-pointer"
          style={{ left: GUTTER }}
          onClick={handleSlotClick}
        >
          {showNowLine && nowMinutes >= 0 && nowMinutes <= 24 * 60 && (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 z-10 flex items-center gap-1"
              style={{ top: (nowMinutes / 60) * ROW_HEIGHT_PX }}
            >
              <span className="h-2 w-2 shrink-0 rounded-full bg-danger" />
              <span className="h-px flex-1 bg-danger/70" />
            </div>
          )}

          {blocks.map(({ card, top, height, lane, laneCount }) => (
            <div
              key={card.id}
              className="absolute px-0.5"
              style={{
                top,
                height,
                left: `${(lane / laneCount) * 100}%`,
                width: `${100 / laneCount}%`,
              }}
              onClick={(event) => event.stopPropagation()}
            >
              <CardChip
                card={card}
                accent={accentFor(card.project_id)}
                onClick={() => onOpenCard(card)}
                className={cn('h-full items-start py-1')}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function minutesSinceMidnight(): number {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}
