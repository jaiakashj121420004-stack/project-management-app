import { useDroppable } from '@dnd-kit/core';
import { format, isToday } from 'date-fns';
import { GlassPanel } from '@/components/glass/GlassPanel';
import { cn } from '@/lib/cn';
import { accentVars, type AccentName } from '@/lib/accents';
import type { Card, Project } from '@/types/database';
import { toDateKey } from './dates';
import { DraggableTimelineBar } from './TimelineBar';
import { barSpan, groupCardsByProject, isClippedEnd, isClippedStart, projectsWithBars } from './timeline';

const LABEL_COL = '9rem';
const DAY_COL = 'minmax(2.75rem, 1fr)';

interface TimelineGridProps {
  days: Date[];
  /** Already scoped to the selected project filter (Calendar's existing
   *  scope select) and to cards with a due_date — same list CalendarGrid gets. */
  cards: Card[];
  projects: Project[];
  accentFor: (projectId: string) => AccentName;
  onOpenCard: (card: Card) => void;
  emptyLabel: string;
}

/**
 * The Timeline/Gantt view (Task 25): every dated card as a horizontal bar
 * across the current month, one row per project (only projects with at least
 * one bar — an empty row for an untouched project would just be clutter),
 * color-coded by the same per-project accent Calendar's chips already use.
 * A single CSS grid backs the whole thing — day columns as grid tracks, bars
 * placed by `gridColumn`/`gridRow` — so bar alignment never drifts from the
 * header's date columns, with no pixel math anywhere.
 */
export function TimelineGrid({ days, cards, projects, accentFor, onOpenCard, emptyLabel }: TimelineGridProps) {
  const cardsByProject = groupCardsByProject(cards);
  const rows = projectsWithBars(projects, cardsByProject);
  const gridTemplateColumns = `${LABEL_COL} repeat(${days.length}, ${DAY_COL})`;

  if (rows.length === 0) {
    return (
      <GlassPanel className="p-6 text-center text-fg-muted">{emptyLabel}</GlassPanel>
    );
  }

  return (
    <GlassPanel className="overflow-x-auto p-2 sm:p-3">
      <div
        className="grid min-w-max"
        style={{ gridTemplateColumns, gridAutoRows: '2.75rem' }}
      >
        {/* Header row: a spacer over the sticky label column, then one cell per day. */}
        <div
          style={{ gridColumn: 1, gridRow: 1 }}
          className="sticky left-0 z-20 h-9 border-b border-[var(--glass-border)] bg-[var(--glass-fill)] backdrop-blur-sm"
        />
        {days.map((date, i) => (
          <div
            key={toDateKey(date)}
            style={{ gridColumn: i + 2, gridRow: 1 }}
            className={cn(
              'z-10 flex h-9 flex-col items-center justify-center border-b border-l border-[var(--glass-border)] text-[0.65rem] font-semibold uppercase tracking-wide text-fg-subtle',
              isToday(date) && 'bg-[var(--accent-from)]/[0.06] text-[color:var(--accent-from)]',
            )}
          >
            <span>{format(date, 'EEEEE')}</span>
            <span className="text-xs font-bold text-fg-muted">{format(date, 'd')}</span>
          </div>
        ))}

        {/* Day-column drop lanes, spanning every project row, behind the bars —
            same droppable-per-day-key convention as DayCell (month/week). */}
        {days.map((date, i) => (
          <DayDropColumn key={toDateKey(date)} date={date} column={i + 2} rowCount={rows.length} />
        ))}

        {/* Project rows + bars. */}
        {rows.map((project, rowIndex) => {
          const rowCards = cardsByProject.get(project.id) ?? [];
          return (
            <div key={project.id} style={{ display: 'contents' }}>
              <div
                style={{ gridColumn: 1, gridRow: rowIndex + 2 }}
                className="sticky left-0 z-20 flex items-center gap-2 border-b border-[var(--glass-border)] bg-[var(--glass-fill)] backdrop-blur-sm pr-2 text-sm font-medium text-fg"
              >
                <span
                  aria-hidden
                  style={accentVars(accentFor(project.id))}
                  className="h-2 w-2 shrink-0 rounded-full bg-[linear-gradient(135deg,var(--accent-from),var(--accent-to))]"
                />
                <span className="truncate">{project.name}</span>
              </div>
              {rowCards.map((card) => {
                const span = barSpan(card, days);
                if (!span) return null;
                return (
                  <div
                    key={card.id}
                    style={{ gridColumn: `${span.startCol + 2} / ${span.endCol + 3}`, gridRow: rowIndex + 2 }}
                    className="z-10 flex items-center border-b border-[var(--glass-border)] px-0.5 py-1"
                  >
                    <DraggableTimelineBar
                      card={card}
                      accent={accentFor(card.project_id)}
                      clippedStart={isClippedStart(card, days)}
                      clippedEnd={isClippedEnd(card, days)}
                      onClick={() => onOpenCard(card)}
                    />
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </GlassPanel>
  );
}

function DayDropColumn({ date, column, rowCount }: { date: Date; column: number; rowCount: number }) {
  const dateKey = toDateKey(date);
  const { setNodeRef, isOver } = useDroppable({ id: dateKey, data: { dateKey } });
  return (
    <div
      ref={setNodeRef}
      style={{ gridColumn: column, gridRow: `2 / span ${rowCount}` }}
      className={cn(
        'z-0 border-l border-[var(--glass-border)] transition-colors',
        isToday(date) && 'bg-[var(--accent-from)]/[0.05]',
        isOver && 'bg-[var(--accent-from)]/10',
      )}
    />
  );
}
