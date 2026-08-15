import { useCallback, useMemo, useState } from 'react';
import { format, startOfToday } from 'date-fns';
import { AlertTriangle, CheckCircle2, Flag as MilestoneIcon, Sparkles } from 'lucide-react';
import { GlassPanel } from '@/components/glass/GlassPanel';
import { Spinner } from '@/components/feedback/Spinner';
import { Reveal } from '@/components/motion/Reveal';
import { accentVars, type AccentName } from '@/lib/accents';
import { dueStatus } from '@/features/board/due';
import { useMyRole } from '@/features/members';
import { useProjects } from '@/features/projects/useProjects';
import { CardDetailModal, type CardDetailValues } from '@/features/board/CardDetailModal';
import { toDateKey } from '@/features/calendar/dates';
import { useDatedCards, useDeleteCalendarCard, useUpdateCalendarCard } from '@/features/calendar/useCalendar';
import { CardChip } from '@/features/calendar/CardChip';
import { TodoListsGrid } from '@/features/todos/TodoListsGrid';
import { useAddTodoList, useTodos } from '@/features/todos/useTodos';
import type { TodoItem } from '@/types/database';

/**
 * "Today" — a single glance combining what's overdue/due soon across every
 * project, today's to-do lists, and any project milestones landing today. The
 * answer to "am I on top of things right now?" without having to visit
 * Boards, Calendar, and To-Do separately (the user-friendliness brainstorm).
 */
export function TodayPage() {
  const todayKey = toDateKey(startOfToday());

  const { data: cards, isLoading: cardsLoading } = useDatedCards();
  const { data: projects } = useProjects();
  const { data: todosData, isLoading: todosLoading } = useTodos(todayKey);
  const addList = useAddTodoList(todayKey);
  const updateCard = useUpdateCalendarCard();
  const deleteCard = useDeleteCalendarCard();

  const [openCardId, setOpenCardId] = useState<string | null>(null);

  const projectsById = useMemo(() => new Map((projects ?? []).map((p) => [p.id, p])), [projects]);
  const accentFor = useCallback(
    (projectId: string): AccentName => projectsById.get(projectId)?.accent ?? 'aurora',
    [projectsById],
  );

  const overdueCards = useMemo(
    () => (cards ?? []).filter((c) => c.due_date && dueStatus(c.due_date) === 'overdue'),
    [cards],
  );
  const dueSoonCards = useMemo(
    () =>
      (cards ?? []).filter((c) => {
        if (!c.due_date) return false;
        const status = dueStatus(c.due_date);
        return status === 'soon'; // today through +2 days
      }),
    [cards],
  );
  const milestonesToday = useMemo(
    () => (projects ?? []).filter((p) => p.target_date === todayKey),
    [projects, todayKey],
  );

  const lists = useMemo(
    () => [...(todosData?.lists ?? [])].sort((a, b) => a.position - b.position),
    [todosData?.lists],
  );
  const itemsByList = useMemo(() => {
    const map = new Map<string, TodoItem[]>();
    for (const item of todosData?.items ?? []) {
      const bucket = map.get(item.list_id);
      if (bucket) bucket.push(item);
      else map.set(item.list_id, [item]);
    }
    return map;
  }, [todosData?.items]);

  const cardsById = useMemo(() => new Map((cards ?? []).map((c) => [c.id, c])), [cards]);
  const openCard = openCardId ? (cardsById.get(openCardId) ?? null) : null;
  const openCardRole = useMyRole(openCard?.project_id);
  const canEditOpenCard = openCardRole !== 'viewer';

  async function handleSaveCard(id: string, values: CardDetailValues) {
    const card = cardsById.get(id);
    if (!card) return;
    await updateCard.mutateAsync({ id, projectId: card.project_id, ...values });
  }

  async function handleDeleteCard(id: string) {
    const card = cardsById.get(id);
    if (!card) return;
    await deleteCard.mutateAsync({ id, projectId: card.project_id });
    setOpenCardId(null);
  }

  function handleQuickAddList() {
    const position = lists.reduce((max, l) => Math.max(max, l.position), 0) + 1000;
    addList.mutate({ name: 'To-do', position, tempId: crypto.randomUUID() });
  }

  const isLoading = cardsLoading || todosLoading;
  const nothingUrgent = overdueCards.length === 0 && dueSoonCards.length === 0 && milestonesToday.length === 0;

  return (
    <div className="flex flex-col gap-6">
      <Reveal>
        <header className="pt-2">
          <p className="text-sm font-medium text-fg-muted">{format(new Date(), 'EEEE, MMMM d')}</p>
          <h1 className="gradient-text mt-1 font-display text-headline font-bold">Today</h1>
          <p className="mt-2 max-w-prose text-fg-muted">
            Everything overdue or due soon, today&apos;s to-dos, and any milestones landing today —
            in one place.
          </p>
        </header>
      </Reveal>

      {isLoading ? (
        <div className="grid place-items-center py-24">
          <Spinner size={32} />
        </div>
      ) : (
        <>
          {nothingUrgent ? (
            <Reveal>
              <GlassPanel className="flex flex-col items-center gap-3 p-10 text-center">
                <CheckCircle2 size={28} className="text-success" />
                <p className="text-fg-muted">Nothing overdue or due soon. You&apos;re on top of it.</p>
              </GlassPanel>
            </Reveal>
          ) : (
            <Reveal>
              <GlassPanel className="p-5 sm:p-6">
                {overdueCards.length > 0 && (
                  <div className="mb-4">
                    <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-danger">
                      <AlertTriangle size={15} /> Overdue ({overdueCards.length})
                    </h2>
                    <div className="flex flex-col gap-1.5">
                      {overdueCards.map((card) => (
                        <CardChip
                          key={card.id}
                          card={card}
                          accent={accentFor(card.project_id)}
                          onClick={() => setOpenCardId(card.id)}
                        />
                      ))}
                    </div>
                  </div>
                )}
                {dueSoonCards.length > 0 && (
                  <div className={overdueCards.length > 0 ? 'border-t border-[var(--glass-border)] pt-4' : ''}>
                    <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-warning">
                      Due soon ({dueSoonCards.length})
                    </h2>
                    <div className="flex flex-col gap-1.5">
                      {dueSoonCards.map((card) => (
                        <CardChip
                          key={card.id}
                          card={card}
                          accent={accentFor(card.project_id)}
                          onClick={() => setOpenCardId(card.id)}
                        />
                      ))}
                    </div>
                  </div>
                )}
                {milestonesToday.length > 0 && (
                  <div className="mt-4 border-t border-[var(--glass-border)] pt-4">
                    <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-fg">
                      <MilestoneIcon size={15} className="text-[var(--accent-from)]" /> Milestones today
                    </h2>
                    <div className="flex flex-wrap gap-2">
                      {milestonesToday.map((project) => (
                        <span
                          key={project.id}
                          style={accentVars(project.accent)}
                          className="rounded-full bg-[var(--glass-fill)] px-3 py-1 text-xs font-medium text-[color:var(--accent-from)]"
                        >
                          {project.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </GlassPanel>
            </Reveal>
          )}

          <Reveal>
            <div className="flex items-center justify-between">
              <h2 className="font-display text-title font-semibold text-fg">Today&apos;s to-dos</h2>
            </div>
          </Reveal>

          {lists.length === 0 ? (
            <Reveal>
              <GlassPanel className="flex flex-col items-center gap-3 p-8 text-center">
                <Sparkles size={24} className="text-fg-subtle" />
                <p className="text-fg-muted">No to-do lists for today yet.</p>
                <button
                  type="button"
                  onClick={handleQuickAddList}
                  className="btn-3d rounded-xl bg-[linear-gradient(110deg,var(--accent-from),var(--accent-to))] px-4 py-2 text-sm font-semibold text-[var(--accent-fg)]"
                >
                  Add a to-do list
                </button>
              </GlassPanel>
            </Reveal>
          ) : (
            <TodoListsGrid dateKey={todayKey} lists={lists} itemsByList={itemsByList} />
          )}
        </>
      )}

      <CardDetailModal
        card={openCard}
        open={Boolean(openCard)}
        projectId={openCard?.project_id ?? ''}
        accent={openCard ? accentFor(openCard.project_id) : 'aurora'}
        canEdit={canEditOpenCard}
        onClose={() => setOpenCardId(null)}
        onSave={handleSaveCard}
        onDelete={handleDeleteCard}
        isPending={updateCard.isPending}
        isDeleting={deleteCard.isPending}
      />
    </div>
  );
}
