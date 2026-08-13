import { memo } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { format, isSameMonth, isToday } from 'date-fns';
import { ListChecks, Flag as MilestoneIcon } from 'lucide-react';
import { cn } from '@/lib/cn';
import { accentVars, type AccentName } from '@/lib/accents';
import type { Card, Project } from '@/types/database';
import { DraggableCardChip } from './CardChip';
import type { CalendarView, DayTodoSummary } from './dates';

interface DayCellProps {
  date: Date;
  dateKey: string;
  cards: Card[];
  todos?: DayTodoSummary;
  milestones?: Project[];
  variant: CalendarView;
  /** Max chips shown before collapsing into "+N more". */
  limit: number;
  /** Days outside this month are dimmed (month variant only). */
  monthCursor: Date;
  accentFor: (projectId: string) => AccentName;
  onOpenCard: (card: Card) => void;
  onPeek: (dateKey: string) => void;
}

/**
 * One calendar day: a drop target (drag a chip here to reschedule) showing its
 * date and the day's card chips, with graceful overflow and an empty state.
 *
 * Memoised (below): a month grid mounts ~35 of these, and dragging a chip
 * re-renders the page — without memo every cell re-rendered on each drag frame.
 * Effective as long as the page passes stable `accentFor`/`onOpenCard`/`onPeek`
 * and a stable empty-array reference for dayless cells (see CalendarGrid).
 */
function DayCellComponent({
  date,
  dateKey,
  cards,
  todos,
  milestones,
  variant,
  limit,
  monthCursor,
  accentFor,
  onOpenCard,
  onPeek,
}: DayCellProps) {
  const { setNodeRef, isOver } = useDroppable({ id: dateKey, data: { dateKey } });
  const today = isToday(date);
  const outside = variant === 'month' && !isSameMonth(date, monthCursor);
  const visible = cards.slice(0, limit);
  const overflow = cards.length - visible.length;
  const hasTodos = Boolean(todos && todos.listCount > 0);
  const hasMilestones = Boolean(milestones && milestones.length > 0);

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex flex-col gap-1 rounded-xl border border-transparent p-1 transition-colors',
        variant === 'month' ? 'min-h-[6.5rem] sm:min-h-[7.5rem]' : 'min-h-[15rem]',
        outside && 'opacity-40',
        isOver && 'border-[var(--accent-from)]/60 bg-[var(--accent-from)]/10',
      )}
    >
      <div className="px-0.5">
        <span
          className={cn(
            'grid h-6 min-w-[1.5rem] place-items-center rounded-full px-1 text-xs font-semibold',
            today
              ? 'bg-[linear-gradient(135deg,var(--accent-from),var(--accent-to))] text-[var(--accent-fg)] shadow-[0_6px_14px_-8px_var(--accent-glow)]'
              : 'text-fg-muted',
          )}
        >
          {format(date, 'd')}
        </span>
      </div>

      <div className={cn('flex min-h-0 flex-col gap-1', variant === 'week' && 'overflow-y-auto')}>
        {visible.map((card) => (
          <DraggableCardChip
            key={card.id}
            card={card}
            accent={accentFor(card.project_id)}
            onClick={() => onOpenCard(card)}
          />
        ))}
        {overflow > 0 && (
          <button
            type="button"
            onClick={() => onPeek(dateKey)}
            className="rounded-lg px-1.5 py-0.5 text-left text-xs font-medium text-fg-subtle transition-colors hover:bg-[var(--glass-fill)] hover:text-fg"
          >
            +{overflow} more
          </button>
        )}

        {(hasTodos || hasMilestones) && (
          <button
            type="button"
            onClick={() => onPeek(dateKey)}
            className="mt-auto flex flex-wrap items-center gap-1 pt-0.5"
          >
            {hasTodos && todos && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--glass-fill)] px-1.5 py-0.5 text-[0.65rem] font-medium text-fg-muted">
                <ListChecks size={10} aria-hidden />
                {todos.done}/{todos.total}
              </span>
            )}
            {hasMilestones &&
              milestones!.slice(0, 3).map((project) => (
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
    </div>
  );
}

export const DayCell = memo(DayCellComponent);
