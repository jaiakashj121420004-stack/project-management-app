import { useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MeasuringStrategy,
  MouseSensor,
  TouchSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { motion, useReducedMotion } from 'framer-motion';
import { GlassPanel } from '@/components/glass/GlassPanel';
import { Skeleton } from '@/components/feedback/Skeleton';
import { accentVars, type AccentName } from '@/lib/accents';
import { springs } from '@/lib/motion';
import type { Card, Column, Label } from '@/types/database';
import { BoardColumn } from './BoardColumn';
import type { CardFace } from './BoardCard';
import { AddColumn } from './AddColumn';
import { CardSurface, type ChecklistProgress } from './CardSurface';
import { CardDetailModal, type CardDetailValues } from './CardDetailModal';
import { DeleteColumnDialog } from './DeleteColumnDialog';
import { Confetti } from './Confetti';
import { BoardToolbar, type DueFilter } from './BoardToolbar';
import { isDueThisWeek, isOverdue } from './due';
import {
  byPosition,
  cardsInColumn,
  isDoneColumn,
  positionBetween,
  sortColumns,
} from './ordering';
import {
  useAddCard,
  useAddColumn,
  useBoard,
  useDeleteCard,
  useDeleteColumn,
  useMoveCard,
  useMoveColumn,
  useRenameColumn,
  useUpdateCard,
} from './useBoard';
import { useCardExtras, useRemoveCardExtras } from './useCardExtras';

type Containers = Record<string, string[]>;
type ActiveType = 'card' | 'column';

interface BoardProps {
  projectId: string;
  accent: AccentName;
  /** Owners/editors can modify the board; viewers see it read-only. */
  canEdit: boolean;
}

/**
 * The Kanban board: a horizontally-scrollable row of columns, each a sortable
 * list of cards. dnd-kit handles dragging; cross-column moves are previewed live
 * in `dndContainers` during the drag, then committed to fractional positions on
 * drop (ordering.ts). Optimistic TanStack mutations make every change feel
 * instant. A confetti burst fires when a card lands in a "Done"-type column.
 */
export function Board({ projectId, accent, canEdit }: BoardProps) {
  const reducedMotion = useReducedMotion();
  const { data, isLoading, isError } = useBoard(projectId);

  const addColumn = useAddColumn(projectId);
  const renameColumn = useRenameColumn(projectId);
  const moveColumn = useMoveColumn(projectId);
  const deleteColumn = useDeleteColumn(projectId);
  const addCard = useAddCard(projectId);
  const updateCard = useUpdateCard(projectId);
  const moveCard = useMoveCard(projectId);
  const deleteCard = useDeleteCard(projectId);
  const removeCardExtras = useRemoveCardExtras(projectId);

  const columns = useMemo(() => (data ? sortColumns(data.columns) : []), [data]);
  const cards = useMemo(() => (data ? [...data.cards].sort(byPosition) : []), [data]);

  const columnsById = useMemo(() => new Map(columns.map((c) => [c.id, c])), [columns]);
  const cardsById = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards]);

  // Phase 5 card extras (labels + checklist) share one cache, read here for the
  // card faces and the toolbar filter; the modal reads + mutates the same cache.
  const { data: extras } = useCardExtras(projectId);
  const projectLabels = useMemo(() => extras?.labels ?? [], [extras?.labels]);
  const labelsById = useMemo(() => new Map(projectLabels.map((l) => [l.id, l])), [projectLabels]);

  const labelsByCardId = useMemo(() => {
    const map = new Map<string, Label[]>();
    for (const link of extras?.cardLabels ?? []) {
      const label = labelsById.get(link.label_id);
      if (!label) continue;
      const list = map.get(link.card_id) ?? [];
      list.push(label);
      map.set(link.card_id, list);
    }
    return map;
  }, [extras?.cardLabels, labelsById]);

  const checklistByCardId = useMemo(() => {
    const map = new Map<string, ChecklistProgress>();
    for (const item of extras?.checklist ?? []) {
      const tally = map.get(item.card_id) ?? { done: 0, total: 0 };
      tally.total += 1;
      if (item.is_done) tally.done += 1;
      map.set(item.card_id, tally);
    }
    return map;
  }, [extras?.checklist]);

  const faceByCardId = useMemo(() => {
    const map = new Map<string, CardFace>();
    for (const card of cards) {
      map.set(card.id, {
        labels: labelsByCardId.get(card.id) ?? [],
        checklist: checklistByCardId.get(card.id) ?? null,
      });
    }
    return map;
  }, [cards, labelsByCardId, checklistByCardId]);

  // Toolbar filter/search state. Hidden cards stay mounted (BoardCard adds
  // `hidden`) so drag ordering, which reads the full lists, stays correct.
  const [query, setQuery] = useState('');
  const [selectedLabelIds, setSelectedLabelIds] = useState<Set<string>>(new Set());
  const [dueFilters, setDueFilters] = useState<Set<DueFilter>>(new Set());

  const trimmedQuery = query.trim().toLowerCase();
  const filtering = trimmedQuery !== '' || selectedLabelIds.size > 0 || dueFilters.size > 0;

  const hiddenCardIds = useMemo(() => {
    const hidden = new Set<string>();
    if (!filtering) return hidden;
    for (const card of cards) {
      const matchesQuery = trimmedQuery === '' || card.title.toLowerCase().includes(trimmedQuery);
      const matchesLabels =
        selectedLabelIds.size === 0 ||
        (labelsByCardId.get(card.id) ?? []).some((label) => selectedLabelIds.has(label.id));
      const matchesDue =
        dueFilters.size === 0 ||
        Boolean(
          card.due_date &&
            ((dueFilters.has('overdue') && isOverdue(card.due_date)) ||
              (dueFilters.has('week') && isDueThisWeek(card.due_date))),
        );
      if (!(matchesQuery && matchesLabels && matchesDue)) hidden.add(card.id);
    }
    return hidden;
  }, [cards, filtering, trimmedQuery, selectedLabelIds, dueFilters, labelsByCardId]);

  function toggleLabelFilter(id: string) {
    setSelectedLabelIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleDueFilter(filter: DueFilter) {
    setDueFilters((prev) => {
      const next = new Set(prev);
      if (next.has(filter)) next.delete(filter);
      else next.add(filter);
      return next;
    });
  }

  function clearFilters() {
    setQuery('');
    setSelectedLabelIds(new Set());
    setDueFilters(new Set());
  }

  const baseColumnOrder = useMemo(() => columns.map((c) => c.id), [columns]);
  const baseContainers = useMemo<Containers>(() => {
    const map: Containers = {};
    for (const column of columns) {
      map[column.id] = cardsInColumn(cards, column.id).map((card) => card.id);
    }
    return map;
  }, [columns, cards]);

  // Live drag state. Null when idle; populated for the duration of a drag so
  // other items reflow as the active item is moved around (incl. across columns).
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<ActiveType | null>(null);
  const [dndColumnOrder, setDndColumnOrder] = useState<string[] | null>(null);
  const [dndContainers, setDndContainers] = useState<Containers | null>(null);

  const [openCardId, setOpenCardId] = useState<string | null>(null);
  const [deletingColumn, setDeletingColumn] = useState<Column | null>(null);
  const [celebrateKey, setCelebrateKey] = useState(0);

  const sensors = useSensors(
    // Mouse needs a little travel before dragging so clicks still open cards.
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    // Touch uses a press-and-hold so taps open and swipes scroll.
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  // Viewers can't drag: an empty sensor set means no drag ever starts (cards
  // still open read-only on click). RLS would reject the write regardless.
  const readOnlySensors = useSensors();
  const activeSensors = canEdit ? sensors : readOnlySensors;

  const columnOrder = dndColumnOrder ?? baseColumnOrder;
  const containers = dndContainers ?? baseContainers;

  function findContainer(id: string, source: Containers): string | undefined {
    if (id in source) return id;
    return Object.keys(source).find((columnId) => source[columnId]?.includes(id));
  }

  function handleDragStart(event: DragStartEvent) {
    const id = String(event.active.id);
    const type = (event.active.data.current?.type as ActiveType | undefined) ?? null;
    setActiveId(id);
    setActiveType(type);
    setDndColumnOrder([...baseColumnOrder]);
    const clone: Containers = {};
    for (const key of Object.keys(baseContainers)) clone[key] = [...(baseContainers[key] ?? [])];
    setDndContainers(clone);
  }

  function handleDragOver(event: DragOverEvent) {
    if (activeType !== 'card') return;
    const { active, over } = event;
    if (!over) return;
    const activeCardId = String(active.id);
    const overId = String(over.id);

    setDndContainers((prev) => {
      if (!prev) return prev;
      const activeContainer = findContainer(activeCardId, prev);
      const overContainer = findContainer(overId, prev);
      if (!activeContainer || !overContainer || activeContainer === overContainer) return prev;

      const activeItems = prev[activeContainer];
      const overItems = prev[overContainer];
      if (!activeItems || !overItems) return prev;

      let newIndex: number;
      if (overId in prev) {
        newIndex = overItems.length; // dropped onto the (possibly empty) column body
      } else {
        const overIndex = overItems.indexOf(overId);
        const translated = active.rect.current.translated;
        const isBelow =
          translated && over.rect ? translated.top > over.rect.top + over.rect.height / 2 : false;
        newIndex = overIndex >= 0 ? overIndex + (isBelow ? 1 : 0) : overItems.length;
      }

      return {
        ...prev,
        [activeContainer]: activeItems.filter((id) => id !== activeCardId),
        [overContainer]: [
          ...overItems.slice(0, newIndex),
          activeCardId,
          ...overItems.slice(newIndex),
        ],
      };
    });
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    const type = activeType;
    const current = dndContainers ?? baseContainers;
    const currentOrder = dndColumnOrder ?? baseColumnOrder;

    // Clear the drag overlay/preview; the optimistic mutation below keeps order.
    setActiveId(null);
    setActiveType(null);
    setDndContainers(null);
    setDndColumnOrder(null);

    if (!over) return;
    const activeIdStr = String(active.id);
    const overId = String(over.id);

    if (type === 'column') {
      const overColumn = findContainer(overId, current);
      if (!overColumn || overColumn === activeIdStr) return;
      const oldIndex = currentOrder.indexOf(activeIdStr);
      const newIndex = currentOrder.indexOf(overColumn);
      if (oldIndex === -1 || newIndex === -1) return;
      const reordered = arrayMove(currentOrder, oldIndex, newIndex);
      const position = neighbourPosition(reordered, activeIdStr, (id) => columnsById.get(id)?.position);
      moveColumn.mutate({ id: activeIdStr, position });
      return;
    }

    if (type === 'card') {
      const destContainer = findContainer(activeIdStr, current);
      if (!destContainer) return;

      // Finalize the within-column index relative to the card we dropped on.
      let finalItems = current[destContainer];
      if (!finalItems) return;
      if (overId !== activeIdStr && !(overId in current) && finalItems.includes(overId)) {
        const oldIndex = finalItems.indexOf(activeIdStr);
        const newIndex = finalItems.indexOf(overId);
        if (oldIndex !== -1 && newIndex !== -1) finalItems = arrayMove(finalItems, oldIndex, newIndex);
      }

      const position = neighbourPosition(finalItems, activeIdStr, (id) => cardsById.get(id)?.position);
      const sourceColumnId = cardsById.get(activeIdStr)?.column_id;
      moveCard.mutate({ id: activeIdStr, columnId: destContainer, position });

      const enteredDone =
        sourceColumnId !== destContainer && isDoneColumn(columnsById.get(destContainer)?.name ?? '');
      if (enteredDone && !reducedMotion) setCelebrateKey((key) => key + 1);
      return;
    }
  }

  function handleDragCancel() {
    setActiveId(null);
    setActiveType(null);
    setDndContainers(null);
    setDndColumnOrder(null);
  }

  function handleAddColumn(name: string) {
    const last = columns[columns.length - 1]?.position;
    addColumn.mutate({ name, position: positionBetween(last, undefined), tempId: crypto.randomUUID() });
  }

  function handleAddCard(columnId: string, title: string) {
    const columnCards = cardsInColumn(cards, columnId);
    const last = columnCards[columnCards.length - 1]?.position;
    addCard.mutate({
      columnId,
      title,
      position: positionBetween(last, undefined),
      tempId: crypto.randomUUID(),
    });
  }

  async function handleConfirmDeleteColumn() {
    if (!deletingColumn) return;
    await deleteColumn.mutateAsync({ id: deletingColumn.id });
    setDeletingColumn(null);
  }

  async function handleSaveCard(id: string, values: CardDetailValues) {
    await updateCard.mutateAsync({
      id,
      title: values.title,
      description: values.description,
      due_date: values.due_date,
      priority: values.priority,
    });
  }

  async function handleDeleteCard(id: string) {
    await deleteCard.mutateAsync({ id });
    // The card's delete cascades to its checklist items + label links in the DB;
    // mirror that in the extras cache so nothing dangles, then close the modal.
    removeCardExtras(id);
    setOpenCardId(null);
  }

  const activeCard = activeType === 'card' && activeId ? cardsById.get(activeId) : undefined;
  const activeColumn = activeType === 'column' && activeId ? columnsById.get(activeId) : undefined;
  const activeFace = activeCard ? faceByCardId.get(activeCard.id) : undefined;
  const openCard = openCardId ? (cardsById.get(openCardId) ?? null) : null;

  if (isLoading) return <BoardSkeleton />;

  if (isError) {
    return (
      <GlassPanel className="p-6 text-center text-fg-muted">
        Couldn&apos;t load this board. Check your connection and try again.
      </GlassPanel>
    );
  }

  return (
    <div className="flex flex-col gap-4" style={accentVars(accent)}>
      <BoardToolbar
        labels={projectLabels}
        query={query}
        onQueryChange={setQuery}
        selectedLabelIds={selectedLabelIds}
        onToggleLabel={toggleLabelFilter}
        dueFilters={dueFilters}
        onToggleDue={toggleDueFilter}
        filtering={filtering}
        onClear={clearFilters}
      />

      <DndContext
        sensors={activeSensors}
        collisionDetection={closestCorners}
        measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className="-mx-1 flex items-start gap-4 overflow-x-auto px-1 pb-4">
          <SortableContext items={columnOrder} strategy={horizontalListSortingStrategy}>
            {columnOrder.map((columnId) => {
              const column = columnsById.get(columnId);
              if (!column) return null;
              const columnCards = (containers[columnId] ?? [])
                .map((id) => cardsById.get(id))
                .filter((card): card is Card => Boolean(card));
              return (
                <BoardColumn
                  key={column.id}
                  column={column}
                  cards={columnCards}
                  faceByCardId={faceByCardId}
                  hiddenCardIds={hiddenCardIds}
                  filtering={filtering}
                  canEdit={canEdit}
                  onRename={(id, name) => renameColumn.mutate({ id, name })}
                  onDelete={setDeletingColumn}
                  onAddCard={handleAddCard}
                  onOpenCard={(card) => setOpenCardId(card.id)}
                />
              );
            })}
          </SortableContext>

          {canEdit && <AddColumn onAdd={handleAddColumn} />}
        </div>

        <DragOverlay dropAnimation={reducedMotion ? null : undefined}>
          {activeCard ? (
            <motion.div
              style={accentVars(accent)}
              animate={reducedMotion ? undefined : { scale: 1.04, rotate: -2 }}
              transition={springs.snappy}
            >
              <CardSurface
                lifted
                title={activeCard.title}
                description={activeCard.description}
                dueDate={activeCard.due_date}
                priority={activeCard.priority}
                labels={activeFace?.labels}
                checklist={activeFace?.checklist}
              />
            </motion.div>
          ) : activeColumn ? (
            <div style={accentVars(accent)}>
              <GlassPanel strong glow className="w-[19rem] rotate-2 p-3">
                <h3 className="font-display font-semibold text-fg">{activeColumn.name}</h3>
                <p className="mt-1 text-xs text-fg-muted">
                  {(baseContainers[activeColumn.id] ?? []).length} cards
                </p>
              </GlassPanel>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <CardDetailModal
        card={openCard}
        open={Boolean(openCard)}
        projectId={projectId}
        accent={accent}
        canEdit={canEdit}
        onClose={() => setOpenCardId(null)}
        onSave={handleSaveCard}
        onDelete={handleDeleteCard}
        isPending={updateCard.isPending}
        isDeleting={deleteCard.isPending}
      />

      <DeleteColumnDialog
        open={Boolean(deletingColumn)}
        onClose={() => setDeletingColumn(null)}
        columnName={deletingColumn?.name ?? ''}
        cardCount={deletingColumn ? (baseContainers[deletingColumn.id]?.length ?? 0) : 0}
        onConfirm={handleConfirmDeleteColumn}
        isPending={deleteColumn.isPending}
      />

      <Confetti fireKey={celebrateKey} />
    </div>
  );
}

/**
 * The position a moved item should take to sit at its new index: the midpoint of
 * the cache positions of the items that now straddle it (the moved item itself
 * is skipped). `order` is the final id order of the destination list.
 */
function neighbourPosition(
  order: string[],
  movedId: string,
  getPosition: (id: string) => number | undefined,
): number {
  const index = order.indexOf(movedId);
  const beforeId = index > 0 ? order[index - 1] : undefined;
  const afterId = index >= 0 && index < order.length - 1 ? order[index + 1] : undefined;
  const before = beforeId !== undefined ? getPosition(beforeId) : undefined;
  const after = afterId !== undefined ? getPosition(afterId) : undefined;
  return positionBetween(before, after);
}

function BoardSkeleton() {
  return (
    <div className="flex items-start gap-4 overflow-hidden pb-4">
      {Array.from({ length: 3 }).map((_, columnIndex) => (
        <div key={columnIndex} className="w-[19rem] shrink-0">
          <Skeleton className="h-9 w-32 rounded-xl" />
          <div className="mt-3 flex flex-col gap-2.5">
            {Array.from({ length: 3 }).map((_, cardIndex) => (
              <Skeleton key={cardIndex} className="h-20 rounded-2xl" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
