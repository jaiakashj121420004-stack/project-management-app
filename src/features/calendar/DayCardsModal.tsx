import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { FolderPlus, ListPlus, ListChecks, Flag as MilestoneIcon } from 'lucide-react';
import { Modal } from '@/components/Modal';
import { accentVars, type AccentName } from '@/lib/accents';
import type { Card, Project } from '@/types/database';
import { CardChip } from './CardChip';
import { toDateKey, type DayTodoSummary } from './dates';

interface DayCardsModalProps {
  open: boolean;
  date: Date | null;
  cards: Card[];
  todos?: DayTodoSummary;
  milestones: Project[];
  accentFor: (projectId: string) => AccentName;
  onClose: () => void;
  onOpenCard: (card: Card) => void;
}

/**
 * The Calendar's day-detail view: opened either from a day's "+N more"
 * overflow or from its to-do/milestone summary chip. Shows everything due
 * that day (cards, to-do progress, project milestones) and lets you jump
 * straight into creating a to-do list or a project pinned to this date —
 * the "create things from inside the calendar" half of the Calendar upgrade.
 */
export function DayCardsModal({
  open,
  date,
  cards,
  todos,
  milestones,
  accentFor,
  onClose,
  onOpenCard,
}: DayCardsModalProps) {
  const navigate = useNavigate();
  const dateKey = date ? toDateKey(date) : null;

  return (
    <Modal open={open} onClose={onClose} title={date ? format(date, 'EEEE, MMMM d') : undefined}>
      <div className="-mr-2 flex max-h-[60vh] flex-col gap-4 overflow-y-auto pr-2">
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
              onClick={() => dateKey && void navigate(`/todos?date=${dateKey}`)}
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

        {cards.length === 0 && (!todos || todos.listCount === 0) && milestones.length === 0 && (
          <p className="py-4 text-center text-sm text-fg-muted">Nothing scheduled this day yet.</p>
        )}

        <section className="flex flex-col gap-1.5 border-t border-[var(--glass-border)] pt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-fg-subtle">Add to this day</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => dateKey && void navigate(`/todos?date=${dateKey}`)}
              className="btn-3d-soft glass-strong flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-medium text-fg"
            >
              <ListPlus size={15} /> New to-do list
            </button>
            <button
              type="button"
              onClick={() => dateKey && void navigate(`/projects?new=1&date=${dateKey}`)}
              className="btn-3d-soft glass-strong flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-medium text-fg"
            >
              <FolderPlus size={15} /> New project
            </button>
          </div>
        </section>
      </div>
    </Modal>
  );
}
