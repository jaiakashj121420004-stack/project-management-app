import { supabase } from '@/lib/supabase';
import { positionBetween } from '@/lib/ordering';
import type { Card, TodoItem, TodoList } from '@/types/database';

/**
 * Supabase data layer for the Calendar view. Like the rest of the app, every
 * call is governed by Row Level Security (plan.md §6) — nothing filters by user;
 * the database returns only cards the caller may see. The TanStack hooks in
 * useCalendar.ts wrap these with caching + optimistic updates.
 */

/**
 * Every card with a due date, across all projects the user can access. The
 * calendar reads this and groups by day; an "all projects" / per-project filter
 * is applied client-side from one query.
 */
export async function fetchDatedCards(): Promise<Card[]> {
  const { data, error } = await supabase
    .from('cards')
    .select('*')
    .not('due_date', 'is', null)
    .order('due_date', { ascending: true });
  if (error) throw error;
  return data;
}

export interface CalendarTodos {
  lists: TodoList[];
  items: TodoItem[];
}

/**
 * Every to-do list (+ its items) whose `list_date` falls within
 * [startKey, endKey] (inclusive) — powers the Calendar's to-do chips. RLS
 * already scopes this to the caller's own lists.
 */
export async function fetchTodoListsInRange(startKey: string, endKey: string): Promise<CalendarTodos> {
  const { data: lists, error: listsError } = await supabase
    .from('todo_lists')
    .select('*')
    .gte('list_date', startKey)
    .lte('list_date', endKey);
  if (listsError) throw listsError;
  if (lists.length === 0) return { lists, items: [] };

  const { data: items, error: itemsError } = await supabase
    .from('todo_items')
    .select('*')
    .in(
      'list_id',
      lists.map((list) => list.id),
    );
  if (itemsError) throw itemsError;
  return { lists, items };
}

/**
 * Reschedule a card's dates (drag-to-reschedule, from Calendar's month/week
 * grid and from the Timeline view). `dueAt` carries the card's time onto the
 * new day (or null when the card had no due time), so a Pro card's timed
 * reminders re-arm against the new instant. `startDate` is omitted entirely
 * for a plain month/week reschedule (that drag never touches it — only
 * Timeline's whole-bar/start-handle drags pass it, `undefined` meaning "leave
 * unchanged" vs. `null` meaning "clear the explicit start").
 */
export async function updateCardDates(
  id: string,
  patch: { dueDate: string | null; dueAt: string | null; startDate?: string | null },
): Promise<Card> {
  const { data, error } = await supabase
    .from('cards')
    .update({
      due_date: patch.dueDate,
      due_at: patch.dueAt,
      ...(patch.startDate !== undefined ? { start_date: patch.startDate } : {}),
    })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export interface QuickCardInput {
  projectId: string;
  title: string;
  /** `YYYY-MM-DD` — always set (the day the user clicked/tapped). */
  dueDate: string;
  /** ISO instant, or null for an all-day card (the all-day row's "+ Add" skips a time). */
  dueAt: string | null;
}

/**
 * Create a new card straight from the Calendar (Day view's click-an-empty-slot
 * and the all-day row's "+ Add"). Appended to the target project's first
 * column by position — deliberately no column picker here, matching Aurora's
 * "useful the moment you open it" default; the card can be dragged to another
 * column on its board afterward like any other card.
 */
export async function createQuickCard(input: QuickCardInput): Promise<Card> {
  const { data: column, error: columnError } = await supabase
    .from('columns')
    .select('id')
    .eq('project_id', input.projectId)
    .order('position', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (columnError) throw columnError;
  if (!column) throw new Error('This project has no columns yet — add one from its board first.');

  const { data: lastCard, error: lastCardError } = await supabase
    .from('cards')
    .select('position')
    .eq('column_id', column.id)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (lastCardError) throw lastCardError;

  const { data, error } = await supabase
    .from('cards')
    .insert({
      project_id: input.projectId,
      column_id: column.id,
      title: input.title,
      position: positionBetween(lastCard?.position, undefined),
      due_date: input.dueDate,
      due_at: input.dueAt,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}
