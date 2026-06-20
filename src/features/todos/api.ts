import { supabase } from '@/lib/supabase';
import type { TodoItem, TodoList } from '@/types/database';

/**
 * Supabase data layer for the daily to-do planner. Every call is governed by Row
 * Level Security (plan.md §6): the lists/items are private to their owner, so
 * these functions never filter by user — the database only returns and accepts
 * the caller's own rows. The hooks in useTodos.ts add caching + optimistic
 * updates. user_id defaults to auth.uid() in the DB, so inserts omit it.
 */

export interface TodosData {
  lists: TodoList[];
  items: TodoItem[];
}

/** All of a day's lists and their items (RLS scopes both to the current user). */
export async function fetchTodos(dateKey: string): Promise<TodosData> {
  const { data: lists, error: listsError } = await supabase
    .from('todo_lists')
    .select('*')
    .eq('list_date', dateKey)
    .order('position', { ascending: true });
  if (listsError) throw listsError;
  if (lists.length === 0) return { lists, items: [] };

  const { data: items, error: itemsError } = await supabase
    .from('todo_items')
    .select('*')
    .in(
      'list_id',
      lists.map((list) => list.id),
    )
    .order('position', { ascending: true });
  if (itemsError) throw itemsError;
  return { lists, items };
}

// --- Lists ------------------------------------------------------------------

export async function insertTodoList(input: {
  dateKey: string;
  name: string;
  position: number;
}): Promise<TodoList> {
  const { data, error } = await supabase
    .from('todo_lists')
    .insert({ list_date: input.dateKey, name: input.name, position: input.position })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function renameTodoList(id: string, name: string): Promise<TodoList> {
  const { data, error } = await supabase
    .from('todo_lists')
    .update({ name })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

/** Delete a list. Its items cascade-delete (ON DELETE CASCADE). */
export async function removeTodoList(id: string): Promise<void> {
  const { error } = await supabase.from('todo_lists').delete().eq('id', id);
  if (error) throw error;
}

// --- Items ------------------------------------------------------------------

export async function insertTodoItem(input: {
  listId: string;
  text: string;
  position: number;
}): Promise<TodoItem> {
  const { data, error } = await supabase
    .from('todo_items')
    .insert({ list_id: input.listId, text: input.text, position: input.position })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function updateTodoItem(
  id: string,
  patch: { text?: string; is_done?: boolean },
): Promise<TodoItem> {
  const { data, error } = await supabase
    .from('todo_items')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function removeTodoItem(id: string): Promise<void> {
  const { error } = await supabase.from('todo_items').delete().eq('id', id);
  if (error) throw error;
}
