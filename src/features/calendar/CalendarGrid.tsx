import { GlassPanel } from '@/components/glass/GlassPanel';
import type { AccentName } from '@/lib/accents';
import type { Card } from '@/types/database';
import { DayCell } from './DayCell';
import { WEEKDAYS, toDateKey, type CalendarView } from './dates';

interface CalendarGridProps {
  days: Date[];
  variant: CalendarView;
  monthCursor: Date;
  cardsByDate: Map<string, Card[]>;
  accentFor: (projectId: string) => AccentName;
  onOpenCard: (card: Card) => void;
  onPeek: (dateKey: string) => void;
}

/**
 * The desktop/tablet calendar: a 7-column grid of day cells. Month view shows
 * full weeks (cells capped at 3 chips); week view shows one taller row that
 * scrolls. Wrapped in one DndContext by the page so chips drag between days.
 */
export function CalendarGrid({
  days,
  variant,
  monthCursor,
  cardsByDate,
  accentFor,
  onOpenCard,
  onPeek,
}: CalendarGridProps) {
  const limit = variant === 'month' ? 3 : 8;

  return (
    <GlassPanel className="p-2 sm:p-3">
      <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
        {WEEKDAYS.map((label) => (
          <div
            key={label}
            className="px-1 pb-1 text-center text-[0.7rem] font-semibold uppercase tracking-wider text-fg-subtle"
          >
            {label}
          </div>
        ))}
        {days.map((date) => {
          const key = toDateKey(date);
          return (
            <DayCell
              key={key}
              date={date}
              dateKey={key}
              cards={cardsByDate.get(key) ?? []}
              variant={variant}
              limit={limit}
              monthCursor={monthCursor}
              accentFor={accentFor}
              onOpenCard={onOpenCard}
              onPeek={onPeek}
            />
          );
        })}
      </div>
    </GlassPanel>
  );
}
