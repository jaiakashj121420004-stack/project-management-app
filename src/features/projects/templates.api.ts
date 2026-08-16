import { supabase } from '@/lib/supabase';
import type { ProjectTemplateRow } from '@/types/database';
import type { ProjectTemplatePayload } from './templateSchemas';

/**
 * Supabase data layer for a user's own project templates ("save as
 * template"). Every call is governed by RLS
 * (20260816170000_project_templates.sql): the policies only return/accept the
 * caller's own rows, so these functions never filter by owner beyond the
 * explicit `source = 'user'` (there are no 'system' rows to accidentally
 * fetch today, but this keeps the query honest if one is ever added).
 * owner_id + updated_at are stamped by project_templates_before_write, so
 * writes never send them. Hooks in useProjectTemplates.ts add caching +
 * optimistic updates.
 */

/** All of the caller's own templates, newest-edited first. */
export async function fetchProjectTemplates(): Promise<ProjectTemplateRow[]> {
  const { data, error } = await supabase
    .from('project_templates')
    .select('*')
    .eq('source', 'user')
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return data;
}

/** Create a template from a validated payload. owner_id/source default
 *  server-side (auth.uid() / 'user'). */
export async function insertProjectTemplate(input: {
  name: string;
  description?: string | null;
  icon?: string | null;
  payload: ProjectTemplatePayload;
}): Promise<ProjectTemplateRow> {
  const { data, error } = await supabase
    .from('project_templates')
    .insert({
      name: input.name,
      description: input.description ?? null,
      icon: input.icon ?? null,
      payload: input.payload,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

/** Rename (and optionally re-describe/re-icon) a template. */
export async function updateProjectTemplateMeta(
  id: string,
  patch: { name: string; description?: string | null; icon?: string | null },
): Promise<ProjectTemplateRow> {
  const { data, error } = await supabase
    .from('project_templates')
    .update({
      name: patch.name,
      description: patch.description ?? null,
      icon: patch.icon ?? null,
    })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function removeProjectTemplate(id: string): Promise<void> {
  const { error } = await supabase.from('project_templates').delete().eq('id', id);
  if (error) throw error;
}
