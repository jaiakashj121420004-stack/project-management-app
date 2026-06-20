import { supabase } from '@/lib/supabase';
import type { Card, Column } from '@/types/database';

/**
 * Thin Supabase data layer for the Kanban board. Every call is governed by Row
 * Level Security (plan.md §6) — these functions never filter by user; the
 * database only returns / accepts rows the caller may touch. The TanStack hooks
 * in useBoard.ts wrap these with caching + optimistic updates.
 */

export interface BoardData {
  columns: Column[];
  cards: Card[];
}

/** Every column + card of a project the user can see (RLS enforces "can see"). */
export async function fetchBoard(projectId: string): Promise<BoardData> {
  const [columnsResult, cardsResult] = await Promise.all([
    supabase
      .from('columns')
      .select('*')
      .eq('project_id', projectId)
      .order('position', { ascending: true }),
    supabase
      .from('cards')
      .select('*')
      .eq('project_id', projectId)
      .order('position', { ascending: true }),
  ]);
  if (columnsResult.error) throw columnsResult.error;
  if (cardsResult.error) throw cardsResult.error;
  return { columns: columnsResult.data, cards: cardsResult.data };
}

// --- Columns ----------------------------------------------------------------

export async function insertColumn(input: {
  projectId: string;
  name: string;
  position: number;
}): Promise<Column> {
  const { data, error } = await supabase
    .from('columns')
    .insert({ project_id: input.projectId, name: input.name, position: input.position })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function renameColumn(id: string, name: string): Promise<Column> {
  const { data, error } = await supabase
    .from('columns')
    .update({ name })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function updateColumnPosition(id: string, position: number): Promise<Column> {
  const { data, error } = await supabase
    .from('columns')
    .update({ position })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

/** Delete a column. Its cards cascade-delete (ON DELETE CASCADE). */
export async function removeColumn(id: string): Promise<void> {
  const { error } = await supabase.from('columns').delete().eq('id', id);
  if (error) throw error;
}

// --- Cards ------------------------------------------------------------------

export async function insertCard(input: {
  projectId: string;
  columnId: string;
  title: string;
  position: number;
}): Promise<Card> {
  const { data, error } = await supabase
    .from('cards')
    .insert({
      project_id: input.projectId,
      column_id: input.columnId,
      title: input.title,
      position: input.position,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function updateCardDetail(
  id: string,
  patch: {
    title: string;
    description: string | null;
    due_date: string | null;
    priority: number | null;
  },
): Promise<Card> {
  const { data, error } = await supabase
    .from('cards')
    .update({
      title: patch.title,
      description: patch.description,
      due_date: patch.due_date,
      priority: patch.priority,
    })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

/** Move a card: new column and/or new fractional position. */
export async function moveCard(
  id: string,
  patch: { columnId: string; position: number },
): Promise<Card> {
  const { data, error } = await supabase
    .from('cards')
    .update({ column_id: patch.columnId, position: patch.position })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function removeCard(id: string): Promise<void> {
  const { error } = await supabase.from('cards').delete().eq('id', id);
  if (error) throw error;
}
