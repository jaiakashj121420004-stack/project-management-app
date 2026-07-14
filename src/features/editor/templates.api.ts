import { supabase } from '@/lib/supabase';
import type { NoteTemplateRow } from '@/types/database';

/**
 * Supabase data layer for custom note templates. Every call is governed by RLS
 * (20260714220000_note_templates.sql): the policies only return and accept the
 * caller's own rows, so these functions never filter by owner. owner_id +
 * updated_at are stamped by the note_templates_before_write trigger, so writes
 * never send them. Hooks in useNoteTemplates.ts add caching + optimistic updates.
 */

/** All of the caller's templates, newest-edited first (RLS-scoped). */
export async function fetchNoteTemplates(): Promise<NoteTemplateRow[]> {
  const { data, error } = await supabase
    .from('note_templates')
    .select('*')
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return data;
}

/** Create a template from a validated Tiptap document. owner_id defaults to
 *  auth.uid() server-side. */
export async function insertNoteTemplate(input: {
  title: string;
  subtitle?: string | null;
  icon?: string | null;
  content_json: Record<string, unknown>;
}): Promise<NoteTemplateRow> {
  const { data, error } = await supabase
    .from('note_templates')
    .insert({
      title: input.title,
      subtitle: input.subtitle ?? null,
      icon: input.icon ?? null,
      content_json: input.content_json,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

/** Rename a template. */
export async function renameNoteTemplate(id: string, title: string): Promise<NoteTemplateRow> {
  const { data, error } = await supabase
    .from('note_templates')
    .update({ title })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

/** Delete a template. */
export async function removeNoteTemplate(id: string): Promise<void> {
  const { error } = await supabase.from('note_templates').delete().eq('id', id);
  if (error) throw error;
}
