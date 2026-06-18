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
import type { Card, Column } from '@/types/database';
import { BoardColumn } from './BoardColumn';
import { AddColumn } from './AddColumn';
import { CardSurface } from './CardSurface';
import { CardDetailModal } from './CardDetailModal';
import { DeleteColumnDialog } from './DeleteColumnDialog';
import { Confetti } from './Confetti';
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
  useDeleteColumn,
  useMoveCard,
  useMoveColumn,
  useRenameColumn,
  useUpdateCard,
} from './useBoard';

type Containers = Record<string, string[]>;
type ActiveType = 'card' | 'column';

interface BoardProps {
  projectId: string;
  accent: AccentName;
}

/**
 * The Kanban board: a horizontally-scrollable row of columns, each a sortable
 * list of cards. dnd-kit handles dragging; cross-column moves are previewed live
 * in `dndContainers` during the drag, then committed to fractional positions on
 * drop (ordering.ts). Optimistic TanStack mutations make every change feel
 * instant. A confetti burst fires when a card lands in a "Done"-type column.
 */
export function Board({ projectId, accent }: BoardProps) {
  const reducedMotion = useReducedMotion();
  const { data, isLoading, isError } = useBoard(projectId);

  const addColumn = useAddColumn(projectId);
  const renameColumn = useRenameColumn(projectId);
  const moveColumn = useMoveColumn(projectId);
  const deleteColumn = useDeleteColumn(projectId);
  const addCard = useAddCard(projectId);
  const updateCard = useUpdateCard(projectId);
  const moveCard = useMoveCard(projectId);

  const columns = useMemo(() => (data ? sortColumns(data.columns) : []), [data]);
  const cards = useMemo(() => (data ? [...data.cards].sort(byPosition) : []), [data]);

  const columnsById = useMemo(() => new Map(columns.map((c) => [c.id, c])), [columns]);
  const cardsById = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards]);

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

  async function handleSaveCard(id: string, values: { title: string; description: string | null }) {
    await updateCard.mutateAsync({ id, title: values.title, description: values.description });
  }

  const activeCard = activeType === 'card' && activeId ? cardsById.get(activeId) : undefined;
  const activeColumn = activeType === 'column' && activeId ? columnsById.get(activeId) : undefined;
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
    <div style={accentVars(accent)}>
      <DndContext
        sensors={sensors}
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
                  onRename={(id, name) => renameColumn.mutate({ id, name })}
                  onDelete={setDeletingColumn}
                  onAddCard={handleAddCard}
                  onOpenCard={(card) => setOpenCardId(card.id)}
                />
              );
            })}
          </SortableContext>

          <AddColumn onAdd={handleAddColumn} />
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
        accent={accent}
        onClose={() => setOpenCardId(null)}
        onSave={handleSaveCard}
        isPending={updateCard.isPending}
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
