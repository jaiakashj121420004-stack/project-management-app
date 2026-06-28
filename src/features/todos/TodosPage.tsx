import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { addDays, format, isFuture, isToday, startOfToday } from 'date-fns';
import { CalendarDays, ChevronLeft, ChevronRight, ListTodo, Plus } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { GlassPanel } from '@/components/glass/GlassPanel';
import { Spinner } from '@/components/feedback/Spinner';
import { Reveal } from '@/components/motion/Reveal';
import { GradientButton } from '@/components/buttons/GradientButton';
import type { TodoItem } from '@/types/database';
import { toDateKey } from '@/features/calendar/dates';
import { todoListNameSchema } from './schemas';
import { useAddTodoList, useTodos } from './useTodos';
import { TodoListCard } from './TodoListCard';
import { getRecurringTemplates } from './recurringTemplates';
import { insertTodoItem, insertTodoList } from './api';

const STEP = 1000;

/**
 * The daily to-do planner: a date at the top with day navigation, and several
 * named lists for that day (Personal, Work, …), each its own checklist. Lists
 * and items are private to the user (RLS) and live in one cache per day.
 */
export function TodosPage() {
  const [cursor, setCursor] = useState<Date>(() => startOfToday());
  const dateKey = toDateKey(cursor);
  const { data, isLoading, isError } = useTodos(dateKey);
  const addList = useAddTodoList(dateKey);
  const queryClient = useQueryClient();
  const seededRef = useRef<Set<string>>(new Set());

  const lists = useMemo(
    () => [...(data?.lists ?? [])].sort((a, b) => a.position - b.position),
    [data?.lists],
  );

  const itemsByList = useMemo(() => {
    const map = new Map<string, TodoItem[]>();
    for (const item of data?.items ?? []) {
      const bucket = map.get(item.list_id);
      if (bucket) bucket.push(item);
      else map.set(item.list_id, [item]);
    }
    return map;
  }, [data?.items]);

  // Auto-seed recurring lists for today and future days.
  useEffect(() => {
    // Only seed today and future days — don't touch past days.
    if (!isToday(cursor) && !isFuture(cursor)) return;
    // Wait until data has loaded and only seed once per dateKey.
    if (isLoading || isError || seededRef.current.has(dateKey)) return;

    const templates = getRecurringTemplates();
    if (templates.length === 0) {
      seededRef.current.add(dateKey);
      return;
    }

    const existingNames = new Set(lists.map((l) => l.name));
    const missing = templates.filter((t) => !existingNames.has(t.name));

    seededRef.current.add(dateKey);

    if (missing.length === 0) return;

    const basePosition = lists.reduce((max, l) => Math.max(max, l.position), 0);

    void (async () => {
      let offset = 1;
      for (const template of missing) {
        try {
          const newList = await insertTodoList({
            dateKey,
            name: template.name,
            position: basePosition + offset * STEP,
          });
          let itemPos = 1;
          for (const text of template.items) {
            await insertTodoItem({ listId: newList.id, text, position: itemPos * STEP });
            itemPos++;
          }
          offset++;
        } catch (err) {
          console.error('[recurring] failed to seed list:', template.name, err);
          // Remove from seeded so it can retry on next render.
          seededRef.current.delete(dateKey);
        }
      }
      void queryClient.invalidateQueries({ queryKey: ['todos', dateKey] });
    })();
  }, [cursor, dateKey, isLoading, isError, lists, queryClient]);

  function handleAddList(name: string) {
    const position = lists.reduce((max, list) => Math.max(max, list.position), 0) + STEP;
    addList.mutate({ name, position, tempId: crypto.randomUUID() });
  }

  return (
    <div className="flex flex-col gap-6">
      <Reveal>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[linear-gradient(135deg,var(--accent-from),var(--accent-to))] text-white shadow-[0_10px_24px_-12px_var(--accent-glow)]">
              <ListTodo size={22} />
            </span>
            <div>
              <h1 className="gradient-text text-2xl font-bold leading-tight">{format(cursor, 'EEEE')}</h1>
              <p className="flex items-center gap-2 text-sm text-fg-muted">
                {format(cursor, 'MMMM d, yyyy')}
                {isToday(cursor) && (
                  <span className="rounded-full bg-[var(--glass-fill)] px-2 py-0.5 text-xs font-semibold text-[var(--accent-from)]">
                    Today
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Previous day"
              onClick={() => setCursor((date) => addDays(date, -1))}
              className="grid h-10 w-10 place-items-center rounded-xl border border-[var(--glass-border)] text-fg-muted transition-colors hover:bg-[var(--glass-fill)] hover:text-fg"
            >
              <ChevronLeft size={18} />
            </button>
            <GradientButton
              variant="secondary"
              size="sm"
              leftIcon={<CalendarDays size={15} />}
              onClick={() => setCursor(startOfToday())}
            >
              Today
            </GradientButton>
            <button
              type="button"
              aria-label="Next day"
              onClick={() => setCursor((date) => addDays(date, 1))}
              className="grid h-10 w-10 place-items-center rounded-xl border border-[var(--glass-border)] text-fg-muted transition-colors hover:bg-[var(--glass-fill)] hover:text-fg"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </Reveal>

      {isLoading ? (
        <div className="grid place-items-center py-24">
          <Spinner size={32} />
        </div>
      ) : isError ? (
        <GlassPanel className="p-6 text-center text-fg-muted">
          Couldn&apos;t load your to-dos. Check your connection and try again.
        </GlassPanel>
      ) : (
        <div className="grid items-start gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {lists.map((list) => (
            <TodoListCard
              key={list.id}
              dateKey={dateKey}
              list={list}
              items={itemsByList.get(list.id) ?? []}
            />
          ))}
          <AddListCard onAdd={handleAddList} hasLists={lists.length > 0} />
        </div>
      )}
    </div>
  );
}

/** A composer card to start a new named list for the day. */
function AddListCard({ onAdd, hasLists }: { onAdd: (name: string) => void; hasLists: boolean }) {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  function submit() {
    const parsed = todoListNameSchema.safeParse(value);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Invalid name.');
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
    <div className="flex flex-col gap-2 rounded-2xl border border-dashed border-[var(--glass-border)] p-4">
      <p className="text-sm font-medium text-fg-muted">
        {hasLists ? 'Add another list' : 'Add your first list (e.g. Personal, Work)'}
      </p>
      <div className="flex items-center gap-2">
        <input
          value={value}
          maxLength={60}
          placeholder="List name…"
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={handleKeyDown}
          aria-label="New list name"
          className="h-9 min-w-0 flex-1 rounded-xl border bg-[var(--field-bg)] px-3 text-sm text-fg placeholder:text-fg-subtle focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--accent-from)]"
        />
        <button
          type="button"
          onClick={submit}
          aria-label="Add list"
          className="btn-3d grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[linear-gradient(110deg,var(--accent-from),var(--accent-to))] text-white"
        >
          <Plus size={16} />
        </button>
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
