import { useState } from 'react';
import { format, isToday } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { CalendarX2, FolderPlus, ListPlus, ListChecks, Plus, Flag as MilestoneIcon } from 'lucide-react';
import { GlassPanel } from '@/components/glass/GlassPanel';
import { accentVars, type AccentName } from '@/lib/accents';
import type { Card, Project } from '@/types/database';
import { CardChip } from './CardChip';
import { QuickAddCardModal } from './QuickAddCardModal';
import { TimeGrid } from './TimeGrid';
import { splitTimedCards } from './dayGrid';
import { toDateKey, type DayTodoSummary } from './dates';

interface DayViewProps {
  date: Date;
  cards: Card[];
  todos?: DayTodoSummary;
  milestones: Project[];
  projects: Project[];
  defaultProjectId: string;
  accentFor: (projectId: string) => AccentName;
  onOpenCard: (card: Card) => void;
}

/**
 * The Day view: a real, navigable single-day schedule (own toolbar state,
 * driven by the same period nav) rather than DayCardsModal's "peek" popup.
 * Timed cards (a `due_at` set) render on an hourly grid like Outlook's day
 * view (see TimeGrid/dayGrid.ts); cards with just a `due_date` sit in the
 * all-day row above it, alongside to-dos and project milestones. Clicking any
 * empty slot — or the all-day row's "+ Add" — opens a small quick-add form
 * (QuickAddCardModal) so a card can be created without leaving the calendar.
 */
export function DayView({
  date,
  cards,
  todos,
  milestones,
  projects,
  defaultProjectId,
  accentFor,
  onOpenCard,
}: DayViewProps) {
  const navigate = useNavigate();
  const dateKey = toDateKey(date);
  const { allDay, timed } = splitTimedCards(cards);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddTime, setQuickAddTime] = useState<string | null>(null);
  const [quickAddSeed, setQuickAddSeed] = useState(0);

  /** Opens the quick-add form fresh for a given slot — `quickAddSeed` remounts
   *  QuickAddCardModal (see its own doc comment) so its fields always start
   *  from this slot's values without a reset-on-open effect. */
  function openQuickAdd(time: string | null) {
    setQuickAddTime(time);
    setQuickAddSeed((seed) => seed + 1);
    setQuickAddOpen(true);
  }
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

      {!hasContent && (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <CalendarX2 size={28} className="text-fg-subtle" />
          <p className="text-fg-muted">Nothing scheduled this day yet.</p>
        </div>
      )}

      <div className="flex flex-col gap-4">
        {(allDay.length > 0 || milestones.length > 0) && (
          <section className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-fg-subtle">All day</p>
              <button
                type="button"
                onClick={() => openQuickAdd(null)}
                className="flex items-center gap-1 rounded-lg px-1.5 py-0.5 text-xs font-medium text-fg-subtle transition-colors hover:bg-[var(--glass-fill)] hover:text-fg"
              >
                <Plus size={12} /> Add
              </button>
            </div>
            {allDay.map((card) => (
              <CardChip key={card.id} card={card} accent={accentFor(card.project_id)} onClick={() => onOpenCard(card)} />
            ))}
            {milestones.map((project) => (
              <button
                key={project.id}
                type="button"
                style={accentVars(project.accent)}
                onClick={() => void navigate(`/projects/${project.id}`)}
                className="flex items-center gap-2 rounded-xl border border-[var(--glass-border)] bg-[var(--glass-fill)] px-3 py-2 text-left text-sm text-fg transition-colors hover:border-[color:var(--accent-from)]"
              >
                <MilestoneIcon size={15} className="text-[var(--accent-from)]" />
                {project.name} milestone
              </button>
            ))}
          </section>
        )}

        <section className="flex flex-col gap-1.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-fg-subtle">Schedule</p>
          <TimeGrid
            cards={timed}
            accentFor={accentFor}
            onOpenCard={onOpenCard}
            onSlotClick={openQuickAdd}
            showNowLine={isToday(date)}
          />
        </section>

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
      </div>

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

      <QuickAddCardModal
        key={quickAddSeed}
        open={quickAddOpen}
        onClose={() => setQuickAddOpen(false)}
        dateKey={dateKey}
        initialTime={quickAddTime}
        projects={projects}
        defaultProjectId={defaultProjectId}
      />
    </GlassPanel>
  );
}
