import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { addDays, format, isFuture, isToday, parseISO, startOfToday } from 'date-fns';
import { useSearchParams } from 'react-router-dom';
import { CalendarDays, ChevronLeft, ChevronRight, ListTodo, Plus } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { GlassPanel } from '@/components/glass/GlassPanel';
import { Spinner } from '@/components/feedback/Spinner';
import { Reveal } from '@/components/motion/Reveal';
import { GradientButton } from '@/components/buttons/GradientButton';
import type { TodoItem } from '@/types/database';
import { toDateKey } from '@/features/calendar/dates';
import { todoListNameSchema } from './schemas';
import { useAddTodoList, useRecurrences, useTodos } from './useTodos';
import { TodoListCard } from './TodoListCard';
import { ruleMatchesDate, type RecurrenceRule } from './recurrence';
import { insertRecurrence, insertTodoItem, insertTodoList, setTodoListRecurrence } from './api';
import { STARTER_TEMPLATES, type StarterTemplate } from './starterTemplates';

const STEP = 1000;

/**
 * The daily to-do planner: a date at the top with day navigation, and several
 * named lists for that day (Personal, Work, …), each its own checklist. Lists
 * and items are private to the user (RLS) and live in one cache per day.
 */
export function TodosPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  // The Calendar's "New to-do list" / day-detail links in here with
  // ?date=YYYY-MM-DD to jump straight to that day — read it once as the
  // initial cursor, then strip it so later navigation isn't pinned to it.
  const [cursor, setCursor] = useState<Date>(() => {
    const wanted = searchParams.get('date');
    if (wanted) {
      try {
        return parseISO(wanted);
      } catch {
        return startOfToday();
      }
    }
    return startOfToday();
  });
  useEffect(() => {
    if (!searchParams.has('date')) return;
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('date');
        return next;
      },
      { replace: true },
    );
    // Runs once on mount to consume the deep-link param — searchParams/setSearchParams
    // are stable-enough router values and re-including them would re-fire this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const dateKey = toDateKey(cursor);
  const { data, isLoading, isError } = useTodos(dateKey);
  const { data: recurrences } = useRecurrences();
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

  // Auto-generate this day's lists from any recurrence rule that matches it —
  // e.g. a "Mon/Wed/Fri" or "every 2 weeks" template. Evaluated lazily against
  // whichever day is being viewed (no cron), and de-duped by
  // `source_recurrence_id` so revisiting a day never creates a second copy,
  // even if that day's list was renamed or emptied out.
  useEffect(() => {
    // Only seed today and future days — don't rewrite history.
    if (!isToday(cursor) && !isFuture(cursor)) return;
    if (isLoading || isError || seededRef.current.has(dateKey)) return;
    if (!recurrences) return; // wait for the recurrence list to load too

    const generatedIds = new Set(
      lists.map((l) => l.source_recurrence_id).filter((id): id is string => Boolean(id)),
    );
    const due = recurrences.filter(
      (r) => !generatedIds.has(r.id) && ruleMatchesDate(r.rule as RecurrenceRule, dateKey),
    );

    seededRef.current.add(dateKey);
    if (due.length === 0) return;

    const basePosition = lists.reduce((max, l) => Math.max(max, l.position), 0);

    void (async () => {
      let offset = 1;
      for (const template of due) {
        try {
          const newList = await insertTodoList({
            dateKey,
            name: template.name,
            position: basePosition + offset * STEP,
            sourceRecurrenceId: template.id,
          });
          let itemPos = 1;
          for (const text of template.items) {
            await insertTodoItem({ listId: newList.id, text, position: itemPos * STEP });
            itemPos++;
          }
          offset++;
        } catch (err) {
          console.error('[recurring] failed to seed list:', template.name, err);
          seededRef.current.delete(dateKey); // allow a retry on next render
        }
      }
      void queryClient.invalidateQueries({ queryKey: ['todos', dateKey] });
    })();
  }, [cursor, dateKey, isLoading, isError, lists, recurrences, queryClient]);

  function handleAddList(name: string) {
    const position = lists.reduce((max, list) => Math.max(max, list.position), 0) + STEP;
    addList.mutate({ name, position, tempId: crypto.randomUUID() });
  }

  /** Create a list from a starter template (Morning Routine, etc.), pre-filled
   *  with its items and set to repeat daily — a routine is meant to recur, and
   *  daily is the free tier, so this works for every plan out of the box. */
  async function handleUseTemplate(template: StarterTemplate) {
    const position = lists.reduce((max, list) => Math.max(max, list.position), 0) + STEP;
    try {
      const [newList, recurrence] = await Promise.all([
        insertTodoList({ dateKey, name: template.name, position }),
        insertRecurrence({ name: template.name, items: template.items, rule: { type: 'daily' } }),
      ]);
      let itemPos = 1;
      for (const text of template.items) {
        await insertTodoItem({ listId: newList.id, text, position: itemPos * STEP });
        itemPos++;
      }
      await setTodoListRecurrence(newList.id, recurrence.id);
    } finally {
      void queryClient.invalidateQueries({ queryKey: ['todos', dateKey] });
      void queryClient.invalidateQueries({ queryKey: ['todo-recurrences'] });
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Reveal>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[linear-gradient(135deg,var(--accent-from),var(--accent-to))] text-[var(--accent-fg)] shadow-[0_10px_24px_-12px_var(--accent-glow)]">
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
          <AddListCard
            onAdd={handleAddList}
            hasLists={lists.length > 0}
            onUseTemplate={(template) => void handleUseTemplate(template)}
          />
        </div>
      )}
    </div>
  );
}

/** A composer card to start a new named list for the day, plus one-tap
 *  starter templates for common routines. */
function AddListCard({
  onAdd,
  hasLists,
  onUseTemplate,
}: {
  onAdd: (name: string) => void;
  hasLists: boolean;
  onUseTemplate: (template: StarterTemplate) => void;
}) {
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
          className="btn-3d grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[linear-gradient(110deg,var(--accent-from),var(--accent-to))] text-[var(--accent-fg)]"
        >
          <Plus size={16} />
        </button>
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}

      <div className="mt-1 flex flex-col gap-1.5">
        <p className="text-xs font-medium text-fg-subtle">Or start from a template</p>
        <div className="flex flex-wrap gap-1.5">
          {STARTER_TEMPLATES.map((template) => (
            <button
              key={template.id}
              type="button"
              onClick={() => onUseTemplate(template)}
              className="flex items-center gap-1.5 rounded-full border border-[var(--glass-border)] px-2.5 py-1 text-xs font-medium text-fg-muted transition-colors hover:border-[color:var(--accent-from)] hover:text-fg"
            >
              <template.icon size={12} />
              {template.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
