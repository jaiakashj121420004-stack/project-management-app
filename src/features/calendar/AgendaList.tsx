import { format, isToday } from 'date-fns';
import { CalendarX2, Flag as MilestoneIcon, ListChecks } from 'lucide-react';
import { GlassPanel } from '@/components/glass/GlassPanel';
import { accentVars, type AccentName } from '@/lib/accents';
import type { Card, Project } from '@/types/database';
import { CardChip } from './CardChip';
import { toDateKey, type DayTodoSummary } from './dates';

interface AgendaListProps {
  days: Date[];
  cardsByDate: Map<string, Card[]>;
  todosByDate: Map<string, DayTodoSummary>;
  projectsByDate: Map<string, Project[]>;
  accentFor: (projectId: string) => AccentName;
  onOpenCard: (card: Card) => void;
  onPeek: (dateKey: string) => void;
  emptyLabel: string;
}

/**
 * The small-phone layout: a scannable list of the days in range that have work,
 * grouped by day. Tap a chip to open the card (where the due date can be changed)
 * — the touch-friendly alternative to dragging on a cramped grid.
 */
export function AgendaList({
  days,
  cardsByDate,
  todosByDate,
  projectsByDate,
  accentFor,
  onOpenCard,
  onPeek,
  emptyLabel,
}: AgendaListProps) {
  const daysWithContent = days
    .map((date) => {
      const key = toDateKey(date);
      return {
        date,
        key,
        cards: cardsByDate.get(key) ?? [],
        todos: todosByDate.get(key),
        milestones: projectsByDate.get(key) ?? [],
      };
    })
    .filter((entry) => entry.cards.length > 0 || entry.todos || entry.milestones.length > 0);

  if (daysWithContent.length === 0) {
    return (
      <GlassPanel className="flex flex-col items-center gap-3 p-10 text-center">
        <CalendarX2 size={28} className="text-fg-subtle" />
        <p className="text-fg-muted">{emptyLabel}</p>
      </GlassPanel>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {daysWithContent.map(({ date, key, cards, todos, milestones }) => (
        <GlassPanel key={key} className="p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-fg">
              {format(date, 'EEE, MMM d')}
              {isToday(date) && (
                <span className="rounded-full bg-[linear-gradient(135deg,var(--accent-from),var(--accent-to))] px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide text-[var(--accent-fg)]">
                  Today
                </span>
              )}
            </h3>
            {(todos || milestones.length > 0) && (
              <button
                type="button"
                onClick={() => onPeek(key)}
                className="flex items-center gap-1.5"
              >
                {todos && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[var(--glass-fill)] px-1.5 py-0.5 text-[0.65rem] font-medium text-fg-muted">
                    <ListChecks size={10} aria-hidden />
                    {todos.done}/{todos.total}
                  </span>
                )}
                {milestones.slice(0, 3).map((project) => (
                  <span
                    key={project.id}
                    title={project.name}
                    style={accentVars(project.accent)}
                    className="inline-flex items-center gap-1 rounded-full bg-[var(--glass-fill)] px-1.5 py-0.5 text-[0.65rem] font-medium text-[color:var(--accent-from)]"
                  >
                    <MilestoneIcon size={10} aria-hidden />
                  </span>
                ))}
              </button>
            )}
          </div>
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
