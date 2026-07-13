import { supabase } from '@/lib/supabase';
import type { Folder } from '@/types/database';

/**
 * Supabase data layer for Library folders. Every call is governed by RLS
 * (20260713120000_library_folders.sql): the policies only return and accept the
 * caller's own folders, so these functions never filter by owner. The hooks in
 * useLibrary.ts add caching + optimistic updates. updated_at + the parent/cycle
 * checks are enforced by the folders_before_write trigger, so writes never send
 * updated_at and a bad move is rejected server-side.
 */

/** All of the caller's folders (RLS-scoped). The tree is assembled client-side
 *  from parent_id; ordering is by position then name for stable sibling order. */
export async function fetchFolders(): Promise<Folder[]> {
  const { data, error } = await supabase
    .from('folders')
    .select('*')
    .order('position', { ascending: true })
    .order('name', { ascending: true });
  if (error) throw error;
  return data;
}

/** Create a folder under `parentId` (null = a top-level folder). owner_id
 *  defaults to auth.uid() server-side. */
export async function insertFolder(input: {
  name: string;
  parentId: string | null;
}): Promise<Folder> {
  const { data, error } = await supabase
    .from('folders')
    .insert({ name: input.name, parent_id: input.parentId })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

/** Rename a folder. */
export async function renameFolder(id: string, name: string): Promise<Folder> {
  const { data, error } = await supabase
    .from('folders')
    .update({ name })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

/** Move a folder under a new parent (null = to the root). The trigger rejects a
 *  move that would create a cycle or target a folder the caller doesn't own. */
export async function moveFolder(id: string, parentId: string | null): Promise<Folder> {
  const { data, error } = await supabase
    .from('folders')
    .update({ parent_id: parentId })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

/** Delete a folder. Subfolders cascade; contained notes/canvases are NOT deleted
 *  — their folder_id is set null (they fall back to the Library root). */
export async function removeFolder(id: string): Promise<void> {
  const { error } = await supabase.from('folders').delete().eq('id', id);
  if (error) throw error;
}
