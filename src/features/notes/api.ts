import { supabase } from '@/lib/supabase';
import type { Note } from '@/types/database';

/**
 * Supabase data layer for per-project notes. Every call is governed by Row Level
 * Security (plan.md §6): the policies only return and accept rows for projects
 * the caller is a member of, so these functions never filter by user. The hooks
 * in useNotes.ts add caching + optimistic updates. updated_at is maintained by a
 * DB trigger, so writes never send it.
 */

/** All notes for a project, most-recently-edited first (RLS-scoped). */
export async function fetchNotes(projectId: string): Promise<Note[]> {
  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .eq('project_id', projectId)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function insertNote(input: { projectId: string; title: string }): Promise<Note> {
  const { data, error } = await supabase
    .from('notes')
    .insert({ project_id: input.projectId, title: input.title })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

/** Patch a note's title and/or content. The trigger refreshes updated_at. */
export async function patchNote(
  id: string,
  patch: { title?: string; content?: string },
): Promise<Note> {
  const { data, error } = await supabase
    .from('notes')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function removeNote(id: string): Promise<void> {
  const { error } = await supabase.from('notes').delete().eq('id', id);
  if (error) throw error;
}
