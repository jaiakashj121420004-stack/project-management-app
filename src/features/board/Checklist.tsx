import { useMemo, useState, type KeyboardEvent } from 'react';
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
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { ListChecks, Plus } from 'lucide-react';
import type { ChecklistItem } from '@/types/database';
import { byPosition, positionBetween } from './ordering';
import { checklistItemTextSchema } from './schemas';
import { ChecklistItemRow } from './ChecklistItemRow';
import {
  useAddChecklistItem,
  useDeleteChecklistItem,
  useUpdateChecklistItem,
} from './useCardExtras';

interface ChecklistProps {
  projectId: string;
  cardId: string;
  items: ChecklistItem[];
}

/**
 * The "to-do list" inside a card: a progress bar, a reorderable list of items
 * (tick / edit / delete), and a quick-add composer. Items reorder within their
 * own nested DndContext; every change is optimistic via useCardExtras.
 */
export function Checklist({ projectId, cardId, items }: ChecklistProps) {
  const addItem = useAddChecklistItem(projectId);
  const updateItem = useUpdateChecklistItem(projectId);
  const deleteItem = useDeleteChecklistItem(projectId);

  const sorted = useMemo(() => [...items].sort(byPosition), [items]);
  const done = sorted.filter((item) => item.is_done).length;
  const total = sorted.length;
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = sorted.map((item) => item.id);
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(sorted, oldIndex, newIndex);
    const landed = reordered.findIndex((item) => item.id === active.id);
    const before = reordered[landed - 1]?.position;
    const after = reordered[landed + 1]?.position;
    updateItem.mutate({ id: String(active.id), position: positionBetween(before, after) });
  }

  function handleAdd(text: string) {
    const last = sorted[sorted.length - 1]?.position;
    addItem.mutate({
      cardId,
      text,
      position: positionBetween(last, undefined),
      tempId: crypto.randomUUID(),
    });
  }

  return (
    <section aria-label="Checklist" className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-fg">
          <ListChecks size={16} aria-hidden /> Checklist
        </h3>
        {total > 0 && (
          <span className="text-xs font-medium text-fg-muted">
            {done}/{total}
          </span>
        )}
      </div>

      {total > 0 && (
        <div
          className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--glass-fill)]"
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Checklist progress"
        >
          <div
            className="h-full rounded-full bg-[linear-gradient(110deg,var(--accent-from),var(--accent-to))] transition-[width] duration-300"
            style={{ width: `${percent}%` }}
          />
        </div>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={sorted.map((item) => item.id)} strategy={verticalListSortingStrategy}>
          <ul className="flex flex-col">
            {sorted.map((item) => (
              <ChecklistItemRow
                key={item.id}
                item={item}
                onToggle={(isDone) => updateItem.mutate({ id: item.id, is_done: isDone })}
                onRename={(text) => updateItem.mutate({ id: item.id, text })}
                onDelete={() => deleteItem.mutate({ id: item.id })}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>

      <ChecklistComposer onAdd={handleAdd} />
    </section>
  );
}

/** Quick-add an item; stays open so several can be added in a row. */
function ChecklistComposer({ onAdd }: { onAdd: (text: string) => void }) {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  function submit() {
    const parsed = checklistItemTextSchema.safeParse(value);
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
      // Add the item without submitting the enclosing card form (which would
      // save + close the modal). The composer is a plain div, not a <form>.
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
          placeholder="Add an item…"
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={handleKeyDown}
          aria-label="New checklist item"
          className="h-9 min-w-0 flex-1 rounded-xl border bg-[var(--field-bg)] px-3 text-sm text-fg placeholder:text-fg-subtle focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--accent-from)]"
        />
        <button
          type="button"
          onClick={submit}
          aria-label="Add item"
          className="btn-3d grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[linear-gradient(110deg,var(--accent-from),var(--accent-to))] text-white"
        >
          <Plus size={16} />
        </button>
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
