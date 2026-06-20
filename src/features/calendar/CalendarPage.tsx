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
import { addMonths, addWeeks, parseISO, startOfToday } from 'date-fns';
import { GlassPanel } from '@/components/glass/GlassPanel';
import { Spinner } from '@/components/feedback/Spinner';
import { Reveal } from '@/components/motion/Reveal';
import { accentVars, type AccentName } from '@/lib/accents';
import { springs } from '@/lib/motion';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import type { Card } from '@/types/database';
import { useProjects } from '@/features/projects/useProjects';
import { useMyRole } from '@/features/members';
import { CardDetailModal, type CardDetailValues } from '@/features/board/CardDetailModal';
import { CalendarToolbar } from './CalendarToolbar';
import { CalendarGrid } from './CalendarGrid';
import { AgendaList } from './AgendaList';
import { CardChip } from './CardChip';
import { DayCardsModal } from './DayCardsModal';
import { calendarDays, groupCardsByDate, periodLabel, type CalendarView } from './dates';
import {
  useDatedCards,
  useDeleteCalendarCard,
  useRescheduleCard,
  useUpdateCalendarCard,
} from './useCalendar';

/**
 * The Calendar view (Phase 6): every card with a due date, across the current
 * project or all of them, laid out by day. Drag a chip to another day to
 * reschedule it (optimistic); click a chip to open the same Phase 5 card modal.
 * Month grid on desktop/tablet, a tap-friendly agenda list on small phones.
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
  const pageAccent: AccentName = scope === 'all' ? 'aurora' : (projectsById.get(scope)?.accent ?? 'aurora');

  const sensors = useSensors(
    // A little travel before dragging so a clean click still opens the card.
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    // Press-and-hold on touch so the calendar can still be scrolled.
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  );

  function handleDragStart(event: DragStartEvent) {
    setActiveCardId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveCardId(null);
    const { active, over } = event;
    if (!over) return;
    const card = cardsById.get(String(active.id));
    const dateKey = String(over.id); // droppable id is the day's date key
    if (!card || card.due_date === dateKey) return;
    reschedule.mutate({ id: card.id, projectId: card.project_id, dueDate: dateKey });
  }

  function goPrev() {
    setCursor((c) => (view === 'month' ? addMonths(c, -1) : addWeeks(c, -1)));
  }
  function goNext() {
    setCursor((c) => (view === 'month' ? addMonths(c, 1) : addWeeks(c, 1)));
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
          onDragCancel={() => setActiveCardId(null)}
        >
          {isWide ? (
            <CalendarGrid
              days={days}
              variant={view}
              monthCursor={cursor}
              cardsByDate={cardsByDate}
              accentFor={accentFor}
              onOpenCard={(card) => setOpenCardId(card.id)}
              onPeek={setPeekDateKey}
            />
          ) : (
            <AgendaList
              days={days}
              cardsByDate={cardsByDate}
              accentFor={accentFor}
              onOpenCard={(card) => setOpenCardId(card.id)}
              emptyLabel={view === 'month' ? 'Nothing scheduled this month.' : 'Nothing scheduled this week.'}
            />
          )}

          <DragOverlay dropAnimation={reducedMotion ? null : undefined}>
            {activeCard ? (
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
