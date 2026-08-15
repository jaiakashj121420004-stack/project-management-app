import { useMemo, type ReactNode } from 'react';
import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { motion, useReducedMotion } from 'framer-motion';
import { GripVertical } from 'lucide-react';
import { cn } from '@/lib/cn';
import { springs } from '@/lib/motion';
import { neighbourPosition } from '@/lib/ordering';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import type { TodoItem, TodoList } from '@/types/database';
import { TodoListCard } from './TodoListCard';
import { useMoveTodoList } from './useTodos';

interface TodoListsGridProps {
  dateKey: string;
  lists: TodoList[];
  itemsByList: Map<string, TodoItem[]>;
  /** Extra, non-draggable grid cell(s) rendered after the lists — e.g.
   *  TodosPage's "add a list" composer — so it stays part of the same
   *  responsive grid flow without being registered as a sortable item. */
  children?: ReactNode;
}

/**
 * A day's named to-do lists (Work, Personal, …), laid out as a responsive grid
 * and drag-reorderable as whole units — the list-level counterpart to the item
 * drag inside each TodoListCard. Shared by TodosPage and TodayPage so both get
 * list reordering from one implementation rather than duplicating the dnd-kit
 * wiring per page.
 */
export function TodoListsGrid({ dateKey, lists, itemsByList, children }: TodoListsGridProps) {
  const moveList = useMoveTodoList(dateKey);
  const listsById = useMemo(() => new Map(lists.map((list) => [list.id, list])), [lists]);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = lists.map((list) => list.id);
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(ids, oldIndex, newIndex);
    const position = neighbourPosition(reordered, String(active.id), (id) => listsById.get(id)?.position);
    moveList.mutate({ id: String(active.id), position });
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <div className="grid items-start gap-5 sm:grid-cols-2 xl:grid-cols-3">
        <SortableContext items={lists.map((list) => list.id)} strategy={rectSortingStrategy}>
          {lists.map((list) => (
            <SortableTodoList
              key={list.id}
              dateKey={dateKey}
              list={list}
              items={itemsByList.get(list.id) ?? []}
            />
          ))}
        </SortableContext>
        {children}
      </div>
    </DndContext>
  );
}

/** One draggable list: a grip handle (owning the dnd-kit listeners) rendered
 *  into TodoListCard's header via the `dragHandle` prop, leaving the card's own
 *  body/interactions untouched. */
function SortableTodoList({ dateKey, list, items }: { dateKey: string; list: TodoList; items: TodoItem[] }) {
  const isTouch = useMediaQuery('(pointer: coarse)');
  const reducedMotion = useReducedMotion();
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({
    id: list.id,
  });

  return (
    <motion.div
      ref={setNodeRef}
      layout={!reducedMotion && !isDragging}
      transition={reducedMotion ? { duration: 0 } : springs.smooth}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(isDragging && 'z-10 opacity-80')}
    >
      <TodoListCard
        dateKey={dateKey}
        list={list}
        items={items}
        dragHandle={
          <button
            type="button"
            aria-label={`Reorder ${list.name} list`}
            className={cn(
              'grid h-6 w-5 shrink-0 cursor-grab touch-none place-items-center rounded-md text-fg-subtle transition-opacity hover:text-fg active:cursor-grabbing',
              isTouch ? 'opacity-100' : 'opacity-0 focus-visible:opacity-100 group-hover:opacity-100',
            )}
            {...attributes}
            {...listeners}
          >
            <GripVertical size={14} aria-hidden />
          </button>
        }
      />
    </motion.div>
  );
}
