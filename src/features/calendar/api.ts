import { supabase } from '@/lib/supabase';
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
 * Reschedule a card to a new due date (drag-to-reschedule). `dueAt` carries the
 * card's time onto the new day (or null when the card had no due time), so a Pro
 * card's timed reminders re-arm against the new instant.
 */
export async function updateCardDueDate(
  id: string,
  dueDate: string | null,
  dueAt: string | null,
): Promise<Card> {
  const { data, error } = await supabase
    .from('cards')
    .update({ due_date: dueDate, due_at: dueAt })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}
