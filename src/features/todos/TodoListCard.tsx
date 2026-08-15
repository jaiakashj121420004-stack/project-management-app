import { useMemo, useState, type KeyboardEvent, type ReactNode } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/cn';
import { Check, CheckSquare, Pencil, Plus, Repeat, Square, Trash2, X } from 'lucide-react';
import { GlassPanel } from '@/components/glass/GlassPanel';
import { Tooltip } from '@/components/Tooltip';
import { useIsPro } from '@/features/billing/useIsPro';
import { neighbourPosition } from '@/lib/ordering';
import { springs } from '@/lib/motion';
import type { TodoItem, TodoList } from '@/types/database';
import { todoItemTextSchema, todoListNameSchema } from './schemas';
import { TodoItemRow } from './TodoItemRow';
import { TodoPriorityPicker } from './TodoPriorityPicker';
import { RecurrenceEditor } from './RecurrenceEditor';
import { describeRule, type RecurrenceRule } from './recurrence';
import { demotedPosition, sameTier, sortTodoItems } from './ordering';
import {
  useAddTodoItem,
  useBulkDeleteTodoItems,
  useBulkUpdateTodoItems,
  useCreateRecurrence,
  useDeleteRecurrence,
  useDeleteTodoItem,
  useDeleteTodoList,
  useLinkTodoListRecurrence,
  useRecurrences,
  useRenameTodoList,
  useUpdateRecurrence,
  useUpdateTodoItem,
} from './useTodos';

interface TodoListCardProps {
  dateKey: string;
  list: TodoList;
  items: TodoItem[];
  /** Grip handle for dragging the whole list (rendered by TodoListsGrid, which
   *  owns the list-level DndContext) — rendered inline in the header, before
   *  the title, when provided. Absent when this card isn't in a draggable grid. */
  dragHandle?: ReactNode;
}

const STEP = 1000;

/** Next fractional position after the current items (simple append). */
function nextPosition(items: TodoItem[]): number {
  return items.reduce((max, item) => Math.max(max, item.position), 0) + STEP;
}

/**
 * A single named to-do list for a day (e.g. "Work"): an editable title with a
 * done/total tally and delete, its items, and a quick-add composer. Items mutate
 * optimistically through useTodos; the composer is a plain div (not a form) so
 * adding never triggers a stray submit.
 */
export function TodoListCard({ dateKey, list, items, dragHandle }: TodoListCardProps) {
  const addItem = useAddTodoItem(dateKey);
  const updateItem = useUpdateTodoItem(dateKey);
  const deleteItem = useDeleteTodoItem(dateKey);
  const renameList = useRenameTodoList(dateKey);
  const deleteList = useDeleteTodoList(dateKey);

  const isPro = useIsPro();
  const { data: recurrences } = useRecurrences();
  const createRecurrence = useCreateRecurrence();
  const updateRecurrenceRule = useUpdateRecurrence();
  const deleteRecurrence = useDeleteRecurrence();
  const linkRecurrence = useLinkTodoListRecurrence(dateKey);

  const bulkUpdate = useBulkUpdateTodoItems(dateKey);
  const bulkDelete = useBulkDeleteTodoItems(dateKey);

  const reducedMotion = useReducedMotion();
  const [renaming, setRenaming] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [repeatOpen, setRepeatOpen] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeItemId, setActiveItemId] = useState<string | null>(null);

  const recurrence = useMemo(
    () => recurrences?.find((r) => r.id === list.source_recurrence_id) ?? null,
    [recurrences, list.source_recurrence_id],
  );
  const rule = (recurrence?.rule as RecurrenceRule | undefined) ?? null;
  const savingRecurrence =
    createRecurrence.isPending || updateRecurrenceRule.isPending || linkRecurrence.isPending;

  // P1 first, then P2, … then unprioritised — position is only the tiebreaker
  // within a tier, so drag/move-order still means something inside each tier.
  const sorted = useMemo(() => sortTodoItems(items), [items]);
  const itemsById = useMemo(() => new Map(sorted.map((item) => [item.id, item])), [sorted]);
  const done = sorted.filter((item) => item.is_done).length;
  const total = sorted.length;

  const itemSensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  // Bulk-select mode replaces the per-row drag handle with a selection
  // checkbox (see TodoItemRow), so no sensor should ever start a drag then.
  const noSensors = useSensors();
  const activeItemSensors = selectMode ? noSensors : itemSensors;

  function handleSaveRecurrence(nextRule: RecurrenceRule) {
    const itemTexts = sorted.map((i) => i.text);
    if (recurrence) {
      updateRecurrenceRule.mutate(
        { id: recurrence.id, name: list.name, items: itemTexts, rule: nextRule },
        { onSuccess: () => setRepeatOpen(false) },
      );
    } else {
      createRecurrence.mutate(
        { name: list.name, items: itemTexts, rule: nextRule },
        {
          onSuccess: (created) => {
            linkRecurrence.mutate({ id: list.id, recurrenceId: created.id });
            setRepeatOpen(false);
          },
        },
      );
    }
  }

  function handleRemoveRecurrence() {
    if (recurrence) deleteRecurrence.mutate(recurrence.id);
    setRepeatOpen(false);
  }

  function handleAdd(text: string) {
    addItem.mutate({
      listId: list.id,
      text,
      position: nextPosition(sorted),
      tempId: crypto.randomUUID(),
    });
  }

  /** Move an item past its neighbour `delta` rows away (-1 up, +1 down) by
   *  giving it a fractional position between its new neighbours — the same
   *  positioning math the board uses (`@/lib/ordering`'s `neighbourPosition`)
   *  and the same one drag-and-drop below writes through. Only meaningful
   *  within the same priority tier — priority always outranks manual order, so
   *  a move across a tier boundary would silently do nothing visually;
   *  `canReorder` below disables the button before that happens, and this is a
   *  defensive no-op if called anyway. */
  function move(index: number, delta: number) {
    if (!canReorder(index, delta)) return;
    const current = sorted[index];
    if (!current) return;
    const ids = sorted.map((item) => item.id);
    const reordered = arrayMove(ids, index, index + delta);
    const position = neighbourPosition(reordered, current.id, (id) => itemsById.get(id)?.position);
    updateItem.mutate({ id: current.id, position });
  }

  /** True when the neighbour `delta` away shares this item's priority tier. */
  function canReorder(index: number, delta: number): boolean {
    const current = sorted[index];
    const neighbour = sorted[index + delta];
    if (!current || !neighbour) return false;
    return sameTier(current, neighbour);
  }

  /** Checking an item off sinks it to the bottom of its priority tier — a
   *  one-time position update at the moment of toggling, not an ongoing sort
   *  criterion (see the `sorted` memo above). The user can then drag it
   *  anywhere afterward, including back above undone items; unchecking never
   *  promotes it back (decision recorded in memory.md, 2026-08-15). */
  function handleToggleDone(item: TodoItem, isDone: boolean) {
    if (!isDone) {
      updateItem.mutate({ id: item.id, is_done: false });
      return;
    }
    const position = demotedPosition(item, sorted);
    updateItem.mutate({ id: item.id, is_done: true, position });
  }

  function handleItemDragStart(event: DragStartEvent) {
    setActiveItemId(String(event.active.id));
  }

  /** Drag-reorder within the list. Dropping onto an item in a *different*
   *  priority tier is a no-op — same rule as the up/down arrows above (priority
   *  always outranks manual order) — so the dragged item springs back to where
   *  it started instead of landing somewhere the sort would immediately undo. */
  function handleItemDragEnd(event: DragEndEvent) {
    setActiveItemId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeItem = itemsById.get(String(active.id));
    const overItem = itemsById.get(String(over.id));
    if (!activeItem || !overItem || !sameTier(activeItem, overItem)) return;

    const ids = sorted.map((item) => item.id);
    const oldIndex = ids.indexOf(activeItem.id);
    const newIndex = ids.indexOf(overItem.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(ids, oldIndex, newIndex);
    const position = neighbourPosition(reordered, activeItem.id, (id) => itemsById.get(id)?.position);
    updateItem.mutate({ id: activeItem.id, position });
  }

  function handleItemDragCancel() {
    setActiveItemId(null);
  }

  function toggleSelectMode() {
    setSelectMode((on) => !on);
    setSelectedIds(new Set());
  }

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleBulkDone(isDone: boolean) {
    bulkUpdate.mutate({ ids: [...selectedIds], is_done: isDone });
    setSelectedIds(new Set());
  }

  function handleBulkPriority(priority: number | null) {
    bulkUpdate.mutate({ ids: [...selectedIds], priority });
    setSelectedIds(new Set());
  }

  function handleBulkDelete() {
    bulkDelete.mutate({ ids: [...selectedIds] });
    setSelectedIds(new Set());
  }

  return (
    <GlassPanel className="group flex flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-1">
          {dragHandle}
          {renaming ? (
            <ListNameEditor
              initial={list.name}
              onSave={(name) => {
                renameList.mutate({ id: list.id, name });
                // The recurrence template keeps its own name in sync too, so it
                // still reads sensibly wherever it's listed on its own.
                if (recurrence && name !== list.name) {
                  updateRecurrenceRule.mutate({ id: recurrence.id, name });
                }
                setRenaming(false);
              }}
              onCancel={() => setRenaming(false)}
            />
          ) : (
            <button
              type="button"
              onClick={() => setRenaming(true)}
              className="min-w-0 flex-1 truncate text-left text-base font-semibold text-fg hover:text-[var(--accent-from)]"
              title="Click to rename"
            >
              {list.name}
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {total > 0 && (
            <span className="text-xs font-medium text-fg-muted">
              {done}/{total}
            </span>
          )}
          {!renaming && total > 0 && (
            <Tooltip label={selectMode ? 'Done selecting' : 'Select items'}>
              <button
                type="button"
                aria-label={selectMode ? 'Exit select mode' : 'Select multiple items'}
                aria-pressed={selectMode}
                onClick={toggleSelectMode}
                className={cn(
                  'grid h-7 w-7 shrink-0 place-items-center rounded-lg transition-colors',
                  selectMode
                    ? 'text-[var(--accent-from)] hover:bg-[var(--glass-fill)]'
                    : 'text-fg-subtle hover:bg-[var(--glass-fill)] hover:text-fg',
                )}
              >
                {selectMode ? <CheckSquare size={14} /> : <Square size={14} />}
              </button>
            </Tooltip>
          )}
          {!renaming && (
            <Tooltip label="Edit name">
              <button
                type="button"
                aria-label="Edit list name"
                onClick={() => setRenaming(true)}
                className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-fg-subtle transition-colors hover:bg-[var(--glass-fill)] hover:text-fg"
              >
                <Pencil size={13} />
              </button>
            </Tooltip>
          )}
          <RecurrenceEditor
            open={repeatOpen}
            onClose={() => setRepeatOpen(false)}
            rule={rule}
            isPro={isPro}
            saving={savingRecurrence}
            onSave={handleSaveRecurrence}
            onRemove={handleRemoveRecurrence}
            trigger={
              <Tooltip label={rule ? describeRule(rule) : 'Repeat…'}>
                <button
                  type="button"
                  aria-label={rule ? `Repeat: ${describeRule(rule)}` : 'Set up repeat'}
                  onClick={() => setRepeatOpen((open) => !open)}
                  className={cn(
                    'grid h-7 w-7 shrink-0 place-items-center rounded-lg transition-colors',
                    rule
                      ? 'text-[var(--accent-from)] hover:bg-[var(--glass-fill)]'
                      : 'text-fg-subtle hover:bg-[var(--glass-fill)] hover:text-fg',
                  )}
                >
                  <Repeat size={14} />
                </button>
              </Tooltip>
            }
          />
          <Tooltip label="Delete list">
            <button
              type="button"
              aria-label="Delete list"
              onClick={() => setConfirmingDelete((open) => !open)}
              className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-fg-subtle transition-colors hover:bg-danger/10 hover:text-danger"
            >
              <Trash2 size={14} />
            </button>
          </Tooltip>
        </div>
      </div>

      {confirmingDelete && (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-fg-muted">
          <span>
            Delete <span className="font-semibold text-fg">{list.name}</span>?
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setConfirmingDelete(false)}
              className="rounded-lg px-2 py-1 text-xs font-medium text-fg-muted hover:bg-[var(--glass-fill)]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => deleteList.mutate({ id: list.id })}
              className="rounded-lg bg-danger/20 px-2 py-1 text-xs font-semibold text-danger hover:bg-danger/30"
            >
              Delete
            </button>
          </div>
        </div>
      )}

      {total > 0 && (
        <DndContext
          sensors={activeItemSensors}
          collisionDetection={closestCenter}
          onDragStart={handleItemDragStart}
          onDragEnd={handleItemDragEnd}
          onDragCancel={handleItemDragCancel}
        >
          <SortableContext items={sorted.map((item) => item.id)} strategy={verticalListSortingStrategy}>
            <ul className="flex flex-col gap-2">
              {sorted.map((item, index) => (
                <TodoItemRow
                  key={item.id}
                  item={item}
                  onToggle={(isDone) => handleToggleDone(item, isDone)}
                  onDelete={() => deleteItem.mutate({ id: item.id })}
                  onEditText={(text) => updateItem.mutate({ id: item.id, text })}
                  onPriorityChange={(priority) => updateItem.mutate({ id: item.id, priority })}
                  onMoveUp={() => move(index, -1)}
                  onMoveDown={() => move(index, 1)}
                  canMoveUp={canReorder(index, -1)}
                  canMoveDown={canReorder(index, 1)}
                  selectMode={selectMode}
                  selected={selectedIds.has(item.id)}
                  onToggleSelect={() => toggleSelected(item.id)}
                />
              ))}
            </ul>
          </SortableContext>

          <ItemDragOverlay item={activeItemId ? itemsById.get(activeItemId) : undefined} reducedMotion={reducedMotion} />
        </DndContext>
      )}

      {selectMode && selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--glass-border)] bg-[var(--glass-fill)] px-3 py-2">
          <span className="text-xs font-semibold text-fg-muted">{selectedIds.size} selected</span>
          <button
            type="button"
            onClick={() => handleBulkDone(true)}
            className="rounded-lg px-2 py-1 text-xs font-medium text-fg hover:bg-[var(--glass-fill)]"
          >
            Mark done
          </button>
          <button
            type="button"
            onClick={() => handleBulkDone(false)}
            className="rounded-lg px-2 py-1 text-xs font-medium text-fg hover:bg-[var(--glass-fill)]"
          >
            Mark not done
          </button>
          <TodoPriorityPicker value={null} onChange={handleBulkPriority} />
          <button
            type="button"
            onClick={handleBulkDelete}
            className="ml-auto rounded-lg px-2 py-1 text-xs font-semibold text-danger hover:bg-danger/10"
          >
            Delete
          </button>
        </div>
      )}

      {!selectMode && <ItemComposer onAdd={handleAdd} />}
    </GlassPanel>
  );
}

/** The floating "lifted" clone of the item being dragged, matching the board's
 *  DragOverlay treatment (springs.snappy) so the two drag interactions feel
 *  like one system. Null while idle or once dnd-kit reports no active item. */
function ItemDragOverlay({ item, reducedMotion }: { item: TodoItem | undefined; reducedMotion: boolean | null }) {
  return (
    <DragOverlay dropAnimation={reducedMotion ? null : undefined}>
      {item ? (
        <motion.div
          animate={reducedMotion ? undefined : { scale: 1.03 }}
          transition={springs.snappy}
          className="flex items-center gap-2.5 rounded-xl bg-base px-3 py-2 shadow-[0_16px_32px_-14px_rgba(0,0,0,0.45)]"
        >
          <span
            className={cn(
              'grid h-5 w-5 shrink-0 place-items-center rounded-md border-2',
              item.is_done
                ? 'border-transparent bg-[linear-gradient(110deg,var(--accent-from),var(--accent-to))] text-[var(--accent-fg)]'
                : 'border-fg-subtle/55',
            )}
          >
            {item.is_done && <Check size={13} strokeWidth={3} aria-hidden />}
          </span>
          <span className={cn('min-w-0 flex-1 truncate text-sm', item.is_done ? 'text-fg-subtle line-through' : 'text-fg')}>
            {item.text}
          </span>
        </motion.div>
      ) : null}
    </DragOverlay>
  );
}

/** Quick-add an item; stays open so several can be added in a row. */
function ItemComposer({ onAdd }: { onAdd: (text: string) => void }) {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  function submit() {
    const parsed = todoItemTextSchema.safeParse(value);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Invalid item.');
      return;
    }
    onAdd(parsed.data);
    setValue('');
    setError(null);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault();
      submit();
    } else if (event.key === 'Escape') {
      setValue('');
      setError(null);
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <input
          value={value}
          maxLength={500}
          placeholder="Add a to-do…"
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={handleKeyDown}
          aria-label="New to-do item"
          className="h-9 min-w-0 flex-1 rounded-xl border bg-[var(--field-bg)] px-3 text-sm text-fg placeholder:text-fg-subtle focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--accent-from)]"
        />
        <button
          type="button"
          onClick={submit}
          aria-label="Add to-do"
          className="btn-3d grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[linear-gradient(110deg,var(--accent-from),var(--accent-to))] text-[var(--accent-fg)]"
        >
          <Plus size={16} />
        </button>
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}

/** Inline title editor for a list. */
function ListNameEditor({
  initial,
  onSave,
  onCancel,
}: {
  initial: string;
  onSave: (name: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initial);
  const [error, setError] = useState<string | null>(null);

  function commit() {
    const parsed = todoListNameSchema.safeParse(value);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Invalid name.');
      return;
    }
    onSave(parsed.data);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault();
      commit();
    } else if (event.key === 'Escape') {
      onCancel();
    }
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <div className="flex items-center gap-1.5">
        <input
          autoFocus
          value={value}
          maxLength={60}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={handleKeyDown}
          aria-label="List name"
          className="h-8 min-w-0 flex-1 rounded-lg border bg-[var(--field-bg)] px-2.5 text-sm font-semibold text-fg focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--accent-from)]"
        />
        <button
          type="button"
          aria-label="Save name"
          onClick={commit}
          className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-[var(--accent-from)] hover:bg-[var(--glass-fill)]"
        >
          <Check size={15} />
        </button>
        <button
          type="button"
          aria-label="Cancel"
          onClick={onCancel}
          className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-fg-subtle hover:bg-[var(--glass-fill)]"
        >
          <X size={15} />
        </button>
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
