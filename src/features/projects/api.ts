import { supabase } from '@/lib/supabase';
import type { AccentName } from '@/lib/accents';
import type { Project } from '@/types/database';

/**
 * Thin Supabase data layer for projects. Every call is governed by Row Level
 * Security (plan.md §6) — these functions never filter by user themselves; the
 * database only ever returns rows the caller may see. The TanStack hooks in
 * useProjects.ts wrap these with caching + optimistic updates.
 */

/** Projects the current user belongs to, newest first. */
export async function fetchProjects(): Promise<Project[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

/** A single project by id, or null if it doesn't exist / isn't visible (RLS). */
export async function fetchProject(id: string): Promise<Project | null> {
  const { data, error } = await supabase.from('projects').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

export interface NewProject {
  ownerId: string;
  name: string;
  description: string | null;
  accent: AccentName;
}

/** Create a project. The DB trigger adds the creator as an owner member. */
export async function insertProject(input: NewProject): Promise<Project> {
  const { data, error } = await supabase
    .from('projects')
    .insert({
      owner_id: input.ownerId,
      name: input.name,
      description: input.description,
      accent: input.accent,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export interface ProjectPatch {
  name: string;
  description: string | null;
  accent: AccentName;
}

/** Update a project (owner only — enforced by RLS, not here). */
export async function patchProject(id: string, patch: ProjectPatch): Promise<Project> {
  const { data, error } = await supabase
    .from('projects')
    .update({ name: patch.name, description: patch.description, accent: patch.accent })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

/** Delete a project (owner only — enforced by RLS). Cascades to members. */
export async function removeProject(id: string): Promise<void> {
  const { error } = await supabase.from('projects').delete().eq('id', id);
  if (error) throw error;
}
