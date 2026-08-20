import { useCallback, useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  pointerWithin,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { motion, useReducedMotion } from 'framer-motion';
import { addMonths, addWeeks, differenceInCalendarDays, parseISO, startOfToday } from 'date-fns';
import { GlassPanel } from '@/components/glass/GlassPanel';
import { Spinner } from '@/components/feedback/Spinner';
import { Reveal } from '@/components/motion/Reveal';
import { accentVars, type AccentName } from '@/lib/accents';
import { springs } from '@/lib/motion';
import { combineDueAt, dueAtTime } from '@/lib/dueAt';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import type { Card } from '@/types/database';
import { useProjects } from '@/features/projects/useProjects';
import { useMyRole } from '@/features/members';
import { CardDetailModal, type CardDetailValues } from '@/features/board/CardDetailModal';
import { CalendarToolbar } from './CalendarToolbar';
import { CalendarGrid } from './CalendarGrid';
import { AgendaList } from './AgendaList';
import { CardChip } from './CardChip';
import { TimelineBarFace } from './TimelineBar';
import { TimelineGrid } from './TimelineGrid';
import { DayCardsModal } from './DayCardsModal';
import { shiftDateKey } from './timeline';
import {
  calendarDays,
  groupCardsByDate,
  groupProjectsByDate,
  groupTodosByDate,
  periodLabel,
  toDateKey,
  type CalendarView,
} from './dates';
import {
  useDatedCards,
  useDatedTodos,
  useDeleteCalendarCard,
  useRescheduleCard,
  useUpdateCalendarCard,
} from './useCalendar';

/** What kind of drag is in flight — a plain month/week reschedule (moves
 *  due_date only) or one of the Timeline view's three drag targets (see
 *  TimelineBar.tsx: the bar body moves start+due together; each edge handle
 *  resizes just its own end). Read from the draggable's `data.kind`. */
type DragKind = 'card' | 'timeline-move' | 'timeline-start' | 'timeline-end';

/**
 * The Calendar view (Phase 6): every card with a due date, across the current
 * project or all of them, laid out by day. Drag a chip to another day to
 * reschedule it (optimistic); click a chip to open the same Phase 5 card modal.
 * Month grid on desktop/tablet, a tap-friendly agenda list on small phones —
 * plus a Timeline/Gantt view (Task 25), a third toggle alongside Month/Week
 * rather than a new nav destination, reusing this same dated-cards query, drag
 * machinery, and per-project accent convention.
 */
export function CalendarPage() {
  const reducedMotion = useReducedMotion();
  const isWide = useMediaQuery('(min-width: 640px)');

  const { data: cards, isLoading, isError } = useDatedCards();
  const { data: projects } = useProjects();

  const reschedule = useRescheduleCard();
  const updateCard = useUpdateCalendarCard();
  const deleteCard = useDeleteCalendarCard();

  const [view, setView] = useState<CalendarView>('month');
  const [cursor, setCursor] = useState<Date>(() => startOfToday());
  const [scope, setScope] = useState<string>('all');
  const [openCardId, setOpenCardId] = useState<string | null>(null);
  const [peekDateKey, setPeekDateKey] = useState<string | null>(null);
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [activeKind, setActiveKind] = useState<DragKind>('card');

  const projectList = useMemo(() => projects ?? [], [projects]);
  const projectsById = useMemo(() => new Map(projectList.map((p) => [p.id, p])), [projectList]);
  const accentFor = useCallback(
    (projectId: string): AccentName => projectsById.get(projectId)?.accent ?? 'aurora',
    [projectsById],
  );

  // One query for every dated card; scope filters client-side.
  const cardsById = useMemo(() => new Map((cards ?? []).map((c) => [c.id, c])), [cards]);
  const scopedCards = useMemo(() => {
    const all = cards ?? [];
    return scope === 'all' ? all : all.filter((c) => c.project_id === scope);
  }, [cards, scope]);
  const cardsByDate = useMemo(() => groupCardsByDate(scopedCards), [scopedCards]);

  const days = useMemo(() => calendarDays(view, cursor), [view, cursor]);
  const rangeStart = useMemo(() => toDateKey(days[0] ?? cursor), [days, cursor]);
  const rangeEnd = useMemo(() => toDateKey(days[days.length - 1] ?? cursor), [days, cursor]);
  const { data: todosInRange } = useDatedTodos(rangeStart, rangeEnd);
  const todosByDate = useMemo(
    () => groupTodosByDate(todosInRange?.lists ?? [], todosInRange?.items ?? []),
    [todosInRange],
  );
  const projectsByDate = useMemo(() => groupProjectsByDate(projectList), [projectList]);

  const pageAccent: AccentName = scope === 'all' ? 'aurora' : (projectsById.get(scope)?.accent ?? 'aurora');

  const sensors = useSensors(
    // A little travel before dragging so a clean click still opens the card.
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    // Press-and-hold on touch so the calendar can still be scrolled.
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  );

  function handleDragStart(event: DragStartEvent) {
    const data = event.active.data.current as { kind?: DragKind; card?: Card } | undefined;
    setActiveKind(data?.kind ?? 'card');
    setActiveCardId(data?.card?.id ?? String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveCardId(null);
    setActiveKind('card');
    const { active, over } = event;
    if (!over) return;
    const data = active.data.current as { kind?: DragKind; card?: Card } | undefined;
    const card = data?.card ?? cardsById.get(String(active.id));
    const dateKey = String(over.id); // droppable id is the day's date key
    if (!card) return;
    const kind = data?.kind ?? 'card';

    // Timeline start-handle: resize just the start, clamped to never pass due_date.
    if (kind === 'timeline-start') {
      const clamped = card.due_date && dateKey > card.due_date ? card.due_date : dateKey;
      if (clamped === (card.start_date ?? null)) return;
      reschedule.mutate({
        id: card.id,
        projectId: card.project_id,
        dueDate: card.due_date,
        dueAt: card.due_at,
        startDate: clamped,
      });
      return;
    }

    // Timeline end-handle: resize just the due date, clamped to never precede the
    // bar's effective start (its start_date, or its own due_date when unset).
    if (kind === 'timeline-end') {
      const effectiveStart = card.start_date ?? card.due_date;
      const clamped = effectiveStart && dateKey < effectiveStart ? effectiveStart : dateKey;
      if (clamped === card.due_date) return;
      const dueAt = card.due_at ? combineDueAt(clamped, dueAtTime(card.due_at)) : null;
      reschedule.mutate({ id: card.id, projectId: card.project_id, dueDate: clamped, dueAt });
      return;
    }

    // Timeline bar body: shift start + due together by the same day delta, so
    // the bar's length never changes — same "whole item moved" shape as
    // dragging a month/week chip, just carrying start_date along too.
    if (kind === 'timeline-move') {
      if (!card.due_date) return;
      const deltaDays = differenceInCalendarDays(parseISO(dateKey), parseISO(card.due_date));
      if (deltaDays === 0) return;
      const newDue = shiftDateKey(card.due_date, deltaDays);
      const newStart = card.start_date ? shiftDateKey(card.start_date, deltaDays) : undefined;
      const dueAt = card.due_at ? combineDueAt(newDue, dueAtTime(card.due_at)) : null;
      reschedule.mutate({ id: card.id, projectId: card.project_id, dueDate: newDue, dueAt, startDate: newStart });
      return;
    }

    // Plain month/week reschedule: due_date only (start_date untouched).
    if (card.due_date === dateKey) return;
    // Preserve the card's time of day (if any) on the new date so timed reminders re-arm.
    const dueAt = card.due_at ? combineDueAt(dateKey, dueAtTime(card.due_at)) : null;
    reschedule.mutate({ id: card.id, projectId: card.project_id, dueDate: dateKey, dueAt });
  }

  function goPrev() {
    setCursor((c) => (view === 'week' ? addWeeks(c, -1) : addMonths(c, -1)));
  }
  function goNext() {
    setCursor((c) => (view === 'week' ? addWeeks(c, 1) : addMonths(c, 1)));
  }

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

  const openCard = openCardId ? (cardsById.get(openCardId) ?? null) : null;
  // Editing rights follow the opened card's project role (a viewer on a shared
  // project gets the read-only card view). Optimistically editable until known.
  const openCardRole = useMyRole(openCard?.project_id);
  const canEditOpenCard = openCardRole !== 'viewer';
  const activeCard = activeCardId ? (cardsById.get(activeCardId) ?? null) : null;
  const peekDate = peekDateKey ? parseISO(peekDateKey) : null;
  const peekCards = peekDateKey ? (cardsByDate.get(peekDateKey) ?? []) : [];
  const peekTodos = peekDateKey ? todosByDate.get(peekDateKey) : undefined;
  const peekMilestones = peekDateKey ? (projectsByDate.get(peekDateKey) ?? []) : [];

  function openCardFromPeek(card: Card) {
    setPeekDateKey(null);
    setOpenCardId(card.id);
  }

  return (
    <div className="flex flex-col gap-6" style={accentVars(pageAccent)}>
      <Reveal>
        <CalendarToolbar
          view={view}
          onViewChange={setView}
          scope={scope}
          onScopeChange={setScope}
          projects={projectList}
          periodLabel={periodLabel(view, cursor)}
          onPrev={goPrev}
          onNext={goNext}
          onToday={() => setCursor(startOfToday())}
        />
      </Reveal>

      {isLoading ? (
        <div className="grid place-items-center py-24">
          <Spinner size={32} />
        </div>
      ) : isError ? (
        <GlassPanel className="p-6 text-center text-fg-muted">
          Couldn&apos;t load your calendar. Check your connection and try again.
        </GlassPanel>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={pointerWithin}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={() => {
            setActiveCardId(null);
            setActiveKind('card');
          }}
        >
          {view === 'timeline' ? (
            <TimelineGrid
              days={days}
              cards={scopedCards}
              projects={projectList}
              accentFor={accentFor}
              onOpenCard={(card) => setOpenCardId(card.id)}
              emptyLabel="Nothing scheduled this month."
            />
          ) : isWide ? (
            <CalendarGrid
              days={days}
              variant={view}
              monthCursor={cursor}
              cardsByDate={cardsByDate}
              todosByDate={todosByDate}
              projectsByDate={projectsByDate}
              accentFor={accentFor}
              onOpenCard={(card) => setOpenCardId(card.id)}
              onPeek={setPeekDateKey}
            />
          ) : (
            <AgendaList
              days={days}
              cardsByDate={cardsByDate}
              todosByDate={todosByDate}
              projectsByDate={projectsByDate}
              accentFor={accentFor}
              onOpenCard={(card) => setOpenCardId(card.id)}
              onPeek={setPeekDateKey}
              emptyLabel={view === 'month' ? 'Nothing scheduled this month.' : 'Nothing scheduled this week.'}
            />
          )}

          <DragOverlay dropAnimation={reducedMotion ? null : undefined}>
            {activeCard && activeKind === 'timeline-move' ? (
              <motion.div
                style={{ width: '9rem', height: '1.75rem' }}
                animate={reducedMotion ? undefined : { scale: 1.05 }}
                transition={springs.snappy}
              >
                <TimelineBarFace card={activeCard} accent={accentFor(activeCard.project_id)} overlay />
              </motion.div>
            ) : activeCard && activeKind === 'card' ? (
              <motion.div
                animate={reducedMotion ? undefined : { scale: 1.05, rotate: -2 }}
                transition={springs.snappy}
              >
                <CardChip card={activeCard} accent={accentFor(activeCard.project_id)} overlay />
              </motion.div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      <DayCardsModal
        open={Boolean(peekDateKey)}
        date={peekDate}
        cards={peekCards}
        todos={peekTodos}
        milestones={peekMilestones}
        accentFor={accentFor}
        onClose={() => setPeekDateKey(null)}
        onOpenCard={openCardFromPeek}
      />

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
