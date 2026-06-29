import { useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import { cn } from '@/lib/cn';
import { Check, Plus, Repeat, Trash2, X } from 'lucide-react';
import { GlassPanel } from '@/components/glass/GlassPanel';
import type { TodoItem, TodoList } from '@/types/database';
import { todoItemTextSchema, todoListNameSchema } from './schemas';
import { TodoItemRow } from './TodoItemRow';
import {
  useAddTodoItem,
  useDeleteTodoItem,
  useDeleteTodoList,
  useMoveTodoItem,
  useRenameTodoList,
  useUpdateTodoItem,
} from './useTodos';
import {
  isRecurring,
  upsertRecurringTemplate,
  removeRecurringTemplate,
} from './recurringTemplates';

interface TodoListCardProps {
  dateKey: string;
  list: TodoList;
  items: TodoItem[];
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
export function TodoListCard({ dateKey, list, items }: TodoListCardProps) {
  const addItem = useAddTodoItem(dateKey);
  const updateItem = useUpdateTodoItem(dateKey);
  const deleteItem = useDeleteTodoItem(dateKey);
  const moveItem = useMoveTodoItem(dateKey);
  const renameList = useRenameTodoList(dateKey);
  const deleteList = useDeleteTodoList(dateKey);

  const [renaming, setRenaming] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [recurring, setRecurring] = useState(() => isRecurring(list.name));
  const [prevListName, setPrevListName] = useState(list.name);

  const sorted = useMemo(() => [...items].sort((a, b) => a.position - b.position), [items]);
  const done = sorted.filter((item) => item.is_done).length;
  const total = sorted.length;

  // Re-derive recurring when the list is renamed by adjusting state DURING render
  // (React's recommended pattern) instead of in an effect — avoids the cascading
  // render that react-hooks/set-state-in-effect warns about.
  if (list.name !== prevListName) {
    setPrevListName(list.name);
    setRecurring(isRecurring(list.name));
  }

  // Keep the stored template up-to-date whenever items change while recurring is on.
  useEffect(() => {
    if (!recurring) return;
    upsertRecurringTemplate({ name: list.name, items: sorted.map((i) => i.text) });
    // list.name intentionally excluded — name changes are handled by the rename path below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sorted]);

  function handleToggleRecurring() {
    if (recurring) {
      removeRecurringTemplate(list.name);
      setRecurring(false);
    } else {
      upsertRecurringTemplate({ name: list.name, items: sorted.map((i) => i.text) });
      setRecurring(true);
    }
  }

  function handleAdd(text: string) {
    addItem.mutate({
      listId: list.id,
      text,
      position: nextPosition(sorted),
      tempId: crypto.randomUUID(),
    });
  }

  /** Swap an item with its neighbour `delta` rows away (-1 up, +1 down). */
  function move(index: number, delta: number) {
    const current = sorted[index];
    const neighbour = sorted[index + delta];
    if (!current || !neighbour) return;
    moveItem.mutate({
      id: current.id,
      position: current.position,
      swapId: neighbour.id,
      swapPosition: neighbour.position,
    });
  }

  return (
    <GlassPanel className="flex flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-2">
        {renaming ? (
          <ListNameEditor
            initial={list.name}
            onSave={(name) => {
              // Keep recurring template in sync when the list is renamed.
              if (recurring && name !== list.name) {
                removeRecurringTemplate(list.name);
                upsertRecurringTemplate({ name, items: sorted.map((i) => i.text) });
              }
              renameList.mutate({ id: list.id, name });
              setRenaming(false);
            }}
            onCancel={() => setRenaming(false)}
          />
        ) : (
          <button
            type="button"
            onClick={() => setRenaming(true)}
            className="min-w-0 flex-1 truncate text-left text-base font-semibold text-fg hover:text-[var(--accent-from)]"
            title="Rename list"
          >
            {list.name}
          </button>
        )}

        <div className="flex items-center gap-1.5">
          {total > 0 && (
            <span className="text-xs font-medium text-fg-muted">
              {done}/{total}
            </span>
          )}
          <button
            type="button"
            aria-label={recurring ? 'Remove from daily routine' : 'Repeat daily'}
            title={recurring ? 'Daily routine — click to remove' : 'Repeat this list every day'}
            onClick={handleToggleRecurring}
            className={cn(
              'grid h-7 w-7 shrink-0 place-items-center rounded-lg transition-colors',
              recurring
                ? 'text-[var(--accent-from)] hover:bg-[var(--glass-fill)]'
                : 'text-fg-subtle hover:bg-[var(--glass-fill)] hover:text-fg',
            )}
          >
            <Repeat size={14} />
          </button>
          <button
            type="button"
            aria-label="Delete list"
            onClick={() => setConfirmingDelete((open) => !open)}
            className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-fg-subtle transition-colors hover:bg-danger/10 hover:text-danger"
          >
            <Trash2 size={14} />
          </button>
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
        <ul className="flex flex-col gap-2">
          {sorted.map((item, index) => (
            <TodoItemRow
              key={item.id}
              item={item}
              onToggle={(isDone) => updateItem.mutate({ id: item.id, is_done: isDone })}
              onDelete={() => deleteItem.mutate({ id: item.id })}
              onMoveUp={() => move(index, -1)}
              onMoveDown={() => move(index, 1)}
              canMoveUp={index > 0}
              canMoveDown={index < sorted.length - 1}
            />
          ))}
        </ul>
      )}

      <ItemComposer onAdd={handleAdd} />
    </GlassPanel>
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
          className="btn-3d grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[linear-gradient(110deg,var(--accent-from),var(--accent-to))] text-white"
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
