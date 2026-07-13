import { format, isToday } from 'date-fns';
import { CalendarX2 } from 'lucide-react';
import { GlassPanel } from '@/components/glass/GlassPanel';
import type { AccentName } from '@/lib/accents';
import type { Card } from '@/types/database';
import { CardChip } from './CardChip';
import { toDateKey } from './dates';

interface AgendaListProps {
  days: Date[];
  cardsByDate: Map<string, Card[]>;
  accentFor: (projectId: string) => AccentName;
  onOpenCard: (card: Card) => void;
  emptyLabel: string;
}

/**
 * The small-phone layout: a scannable list of the days in range that have work,
 * grouped by day. Tap a chip to open the card (where the due date can be changed)
 * — the touch-friendly alternative to dragging on a cramped grid.
 */
export function AgendaList({ days, cardsByDate, accentFor, onOpenCard, emptyLabel }: AgendaListProps) {
  const daysWithCards = days
    .map((date) => ({ date, cards: cardsByDate.get(toDateKey(date)) ?? [] }))
    .filter((entry) => entry.cards.length > 0);

  if (daysWithCards.length === 0) {
    return (
      <GlassPanel className="flex flex-col items-center gap-3 p-10 text-center">
        <CalendarX2 size={28} className="text-fg-subtle" />
        <p className="text-fg-muted">{emptyLabel}</p>
      </GlassPanel>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {daysWithCards.map(({ date, cards }) => (
        <GlassPanel key={toDateKey(date)} className="p-3">
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-fg">
            {format(date, 'EEE, MMM d')}
            {isToday(date) && (
              <span className="rounded-full bg-[linear-gradient(135deg,var(--accent-from),var(--accent-to))] px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide text-[var(--accent-fg)]">
                Today
              </span>
            )}
          </h3>
          <div className="flex flex-col gap-1.5">
            {cards.map((card) => (
              <CardChip
                key={card.id}
                card={card}
                accent={accentFor(card.project_id)}
                onClick={() => onOpenCard(card)}
              />
            ))}
          </div>
        </GlassPanel>
      ))}
    </div>
  );
}
