import { format, isToday } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { CalendarX2, FolderPlus, ListPlus, ListChecks, Flag as MilestoneIcon } from 'lucide-react';
import { GlassPanel } from '@/components/glass/GlassPanel';
import { accentVars, type AccentName } from '@/lib/accents';
import type { Card, Project } from '@/types/database';
import { CardChip } from './CardChip';
import { toDateKey, type DayTodoSummary } from './dates';

interface DayViewProps {
  date: Date;
  cards: Card[];
  todos?: DayTodoSummary;
  milestones: Project[];
  accentFor: (projectId: string) => AccentName;
  onOpenCard: (card: Card) => void;
}

/**
 * The Day view: a fourth toolbar option alongside Month/Week/Timeline — a
 * real, navigable single-day view (its own toolbar state, driven by the same
 * period nav) rather than DayCardsModal's "peek" popup. Useful on a phone, or
 * any day with a lot happening. Mirrors DayCardsModal's exact sections (cards,
 * to-dos, milestones, "add to this day") so the two stay consistent, but
 * DayCardsModal itself is untouched — it's still used everywhere else (the
 * month/week grid's "+N more" and to-do/milestone summary chips).
 */
export function DayView({ date, cards, todos, milestones, accentFor, onOpenCard }: DayViewProps) {
  const navigate = useNavigate();
  const dateKey = toDateKey(date);
  const hasContent = cards.length > 0 || Boolean(todos && todos.listCount > 0) || milestones.length > 0;

  return (
    <GlassPanel className="flex flex-col gap-4 p-4 sm:p-5">
      <div className="flex items-center gap-2">
        <h2 className="font-display text-lg font-semibold text-fg">{format(date, 'EEEE, MMMM d')}</h2>
        {isToday(date) && (
          <span className="rounded-full bg-[linear-gradient(135deg,var(--accent-from),var(--accent-to))] px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide text-[var(--accent-fg)]">
            Today
          </span>
        )}
      </div>

      {!hasContent ? (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <CalendarX2 size={28} className="text-fg-subtle" />
          <p className="text-fg-muted">Nothing scheduled this day yet.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {cards.length > 0 && (
            <section className="flex flex-col gap-1.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-fg-subtle">Cards</p>
              {cards.map((card) => (
                <CardChip
                  key={card.id}
                  card={card}
                  accent={accentFor(card.project_id)}
                  onClick={() => onOpenCard(card)}
                />
              ))}
            </section>
          )}

          {todos && todos.listCount > 0 && (
            <section className="flex flex-col gap-1.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-fg-subtle">To-dos</p>
              <button
                type="button"
                onClick={() => void navigate(`/todos?date=${dateKey}`)}
                className="flex items-center justify-between gap-2 rounded-xl border border-[var(--glass-border)] bg-[var(--glass-fill)] px-3 py-2 text-left text-sm transition-colors hover:border-[color:var(--accent-from)]"
              >
                <span className="flex items-center gap-2 text-fg">
                  <ListChecks size={15} className="text-[var(--accent-from)]" />
                  {todos.listCount} {todos.listCount === 1 ? 'list' : 'lists'}
                </span>
                <span className="text-fg-muted">
                  {todos.done}/{todos.total} done
                </span>
              </button>
            </section>
          )}

          {milestones.length > 0 && (
            <section className="flex flex-col gap-1.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-fg-subtle">
                Project milestones
              </p>
              {milestones.map((project) => (
                <button
                  key={project.id}
                  type="button"
                  style={accentVars(project.accent)}
                  onClick={() => void navigate(`/projects/${project.id}`)}
                  className="flex items-center gap-2 rounded-xl border border-[var(--glass-border)] bg-[var(--glass-fill)] px-3 py-2 text-left text-sm text-fg transition-colors hover:border-[color:var(--accent-from)]"
                >
                  <MilestoneIcon size={15} className="text-[var(--accent-from)]" />
                  {project.name}
                </button>
              ))}
            </section>
          )}
        </div>
      )}

      <section className="flex flex-col gap-1.5 border-t border-[var(--glass-border)] pt-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-fg-subtle">Add to this day</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void navigate(`/todos?date=${dateKey}`)}
            className="btn-3d-soft glass-strong flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-medium text-fg"
          >
            <ListPlus size={15} /> New to-do list
          </button>
          <button
            type="button"
            onClick={() => void navigate(`/projects?new=1&date=${dateKey}`)}
            className="btn-3d-soft glass-strong flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-medium text-fg"
          >
            <FolderPlus size={15} /> New project
          </button>
        </div>
      </section>
    </GlassPanel>
  );
}
