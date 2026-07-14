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

/** Every standalone (project-less) note the caller owns, newest-edited first.
 *  RLS scopes to the owner (project_id is null → the member path never matches),
 *  so we never filter by user here. Backs the Library. */
export async function fetchStandaloneNotes(): Promise<Note[]> {
  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .is('project_id', null)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return data;
}

/** Create a standalone note, optionally filed into a Library folder. project_id
 *  stays null; owner_id defaults to auth.uid() server-side. */
export async function insertStandaloneNote(input: {
  title: string;
  folderId?: string | null;
}): Promise<Note> {
  const { data, error } = await supabase
    .from('notes')
    .insert({ project_id: null, title: input.title, folder_id: input.folderId ?? null })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

/** Patch a note's title, content, block document and/or Library folder. The
 *  trigger refreshes updated_at. folder_id only applies to standalone notes.
 *  content_json is the Tiptap document (jsonb); content is its plain-text mirror. */
export async function patchNote(
  id: string,
  patch: {
    title?: string;
    icon?: string | null;
    content?: string;
    content_json?: Record<string, unknown> | null;
    folder_id?: string | null;
  },
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
