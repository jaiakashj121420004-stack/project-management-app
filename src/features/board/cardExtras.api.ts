import { supabase } from '@/lib/supabase';
import type { CardLabel, ChecklistItem, Label } from '@/types/database';
import type { LabelColor } from '@/lib/labelColors';

/**
 * Supabase data layer for the per-card extras introduced in Phase 5: checklist
 * items, project labels, and card↔label attachments. Like the board layer,
 * every call is governed by Row Level Security (plan.md §6) — nothing filters by
 * user. The TanStack hooks in useCardExtras.ts wrap these with one optimistic
 * cache per project.
 */

export interface CardExtras {
  labels: Label[];
  checklist: ChecklistItem[];
  cardLabels: CardLabel[];
}

/**
 * Every label, checklist item, and attachment for a project's cards. Checklist
 * items and attachments aren't project-scoped at the table level (they hang off
 * a card), so we resolve the project's card ids first, then fetch by them.
 */
export async function fetchCardExtras(projectId: string): Promise<CardExtras> {
  const { data: cardRows, error: cardError } = await supabase
    .from('cards')
    .select('id')
    .eq('project_id', projectId);
  if (cardError) throw cardError;
  const cardIds = cardRows.map((row) => row.id);

  const [labelsResult, checklistResult, cardLabelsResult] = await Promise.all([
    supabase
      .from('labels')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true }),
    supabase
      .from('checklist_items')
      .select('*')
      .in('card_id', cardIds)
      .order('position', { ascending: true }),
    supabase.from('card_labels').select('*').in('card_id', cardIds),
  ]);
  if (labelsResult.error) throw labelsResult.error;
  if (checklistResult.error) throw checklistResult.error;
  if (cardLabelsResult.error) throw cardLabelsResult.error;

  return {
    labels: labelsResult.data,
    checklist: checklistResult.data,
    cardLabels: cardLabelsResult.data,
  };
}

// --- Labels -----------------------------------------------------------------

export async function insertLabel(input: {
  projectId: string;
  name: string;
  color: LabelColor;
}): Promise<Label> {
  const { data, error } = await supabase
    .from('labels')
    .insert({ project_id: input.projectId, name: input.name, color: input.color })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function removeLabel(id: string): Promise<void> {
  const { error } = await supabase.from('labels').delete().eq('id', id);
  if (error) throw error;
}

// --- Card ↔ label attachments ----------------------------------------------

export async function attachLabel(cardId: string, labelId: string): Promise<void> {
  const { error } = await supabase
    .from('card_labels')
    .insert({ card_id: cardId, label_id: labelId });
  if (error) throw error;
}

export async function detachLabel(cardId: string, labelId: string): Promise<void> {
  const { error } = await supabase
    .from('card_labels')
    .delete()
    .eq('card_id', cardId)
    .eq('label_id', labelId);
  if (error) throw error;
}

// --- Checklist items --------------------------------------------------------

export async function insertChecklistItem(input: {
  cardId: string;
  text: string;
  position: number;
}): Promise<ChecklistItem> {
  const { data, error } = await supabase
    .from('checklist_items')
    .insert({ card_id: input.cardId, text: input.text, position: input.position })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function updateChecklistItem(
  id: string,
  patch: { text?: string; is_done?: boolean; position?: number },
): Promise<ChecklistItem> {
  const { data, error } = await supabase
    .from('checklist_items')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function removeChecklistItem(id: string): Promise<void> {
  const { error } = await supabase.from('checklist_items').delete().eq('id', id);
  if (error) throw error;
}
