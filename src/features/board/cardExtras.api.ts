import { supabase } from '@/lib/supabase';
import type { CardAttachment, CardLabel, ChecklistItem, Label, TimeEntry } from '@/types/database';
import type { LabelColor } from '@/lib/labelColors';
import { deleteCardAttachmentObject, uploadCardAttachment } from './cardAttachments';

/**
 * Supabase data layer for the per-card extras introduced in Phase 5 (checklist
 * items, project labels, card↔label attachments) plus time entries (v1 time
 * tracking, plan.md §5) and file attachments (card_attachments,
 * 20260816160000_card_attachments.sql). Like the board layer, every call is
 * governed by Row Level Security (plan.md §6) — nothing filters by user (time
 * entries and file attachments are the exceptions where WRITES are additionally
 * scoped to role/ownership; see the migrations). The TanStack hooks in
 * useCardExtras.ts wrap these with one optimistic cache per project.
 */

export interface CardExtras {
  labels: Label[];
  checklist: ChecklistItem[];
  cardLabels: CardLabel[];
  timeEntries: TimeEntry[];
  attachments: CardAttachment[];
}

/**
 * Every label, checklist item, attachment, and time entry for a project's
 * cards. None of these are project-scoped at the table level (they hang off a
 * card), so we resolve the project's card ids first, then fetch by them.
 */
export async function fetchCardExtras(projectId: string): Promise<CardExtras> {
  const { data: cardRows, error: cardError } = await supabase
    .from('cards')
    .select('id')
    .eq('project_id', projectId);
  if (cardError) throw cardError;
  const cardIds = cardRows.map((row) => row.id);

  const [labelsResult, checklistResult, cardLabelsResult, timeEntriesResult, attachmentsResult] =
    await Promise.all([
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
      supabase
        .from('time_entries')
        .select('*')
        .in('card_id', cardIds)
        .order('started_at', { ascending: true }),
      supabase
        .from('card_attachments')
        .select('*')
        .in('card_id', cardIds)
        .order('created_at', { ascending: true }),
    ]);
  if (labelsResult.error) throw labelsResult.error;
  if (checklistResult.error) throw checklistResult.error;
  if (cardLabelsResult.error) throw cardLabelsResult.error;
  if (timeEntriesResult.error) throw timeEntriesResult.error;
  if (attachmentsResult.error) throw attachmentsResult.error;

  return {
    labels: labelsResult.data,
    checklist: checklistResult.data,
    cardLabels: cardLabelsResult.data,
    timeEntries: timeEntriesResult.data,
    attachments: attachmentsResult.data,
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

// --- Time entries -------------------------------------------------------------

/**
 * Start a timer on a card for the given user. "One running entry per user at a
 * time" is a whole-account rule, not just per-card (v1 scope, memory.md), so
 * this first stops any entry already running for this user — on this card or
 * another — before inserting the new one. The DB's partial unique index
 * (time_entries_one_running_per_user) is the real guarantee behind this
 * sequencing; a race here would surface as an insert error, not overlapping
 * entries.
 */
export async function startTimeEntry(input: { cardId: string; userId: string }): Promise<TimeEntry> {
  const { error: stopError } = await supabase
    .from('time_entries')
    .update({ ended_at: new Date().toISOString() })
    .eq('user_id', input.userId)
    .is('ended_at', null);
  if (stopError) throw stopError;

  const { data, error } = await supabase
    .from('time_entries')
    .insert({ card_id: input.cardId, user_id: input.userId })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function stopTimeEntry(id: string): Promise<TimeEntry> {
  const { data, error } = await supabase
    .from('time_entries')
    .update({ ended_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

// --- Attachments --------------------------------------------------------------

/**
 * Upload a file to the card-attachments bucket, then record it. If the DB
 * insert fails (e.g. a race with a role change) the just-uploaded object is
 * cleaned up rather than left orphaned in Storage.
 */
export async function addCardAttachment(input: {
  cardId: string;
  uploaderId: string;
  file: File;
}): Promise<CardAttachment> {
  const { path } = await uploadCardAttachment(input.cardId, input.file);
  const { data, error } = await supabase
    .from('card_attachments')
    .insert({
      card_id: input.cardId,
      uploader_id: input.uploaderId,
      storage_path: path,
      file_name: input.file.name || 'Untitled',
      mime_type: input.file.type || 'application/octet-stream',
      size_bytes: input.file.size,
    })
    .select('*')
    .single();
  if (error) {
    await deleteCardAttachmentObject(path).catch(() => {
      // Best-effort cleanup — an orphaned object is harmless and unreferenced.
    });
    throw error;
  }
  return data;
}

/** Delete an attachment's row, then its backing Storage object. Order matters:
 *  if the row delete is rejected by RLS (not the uploader, not an editor), the
 *  object is never touched. */
export async function removeCardAttachment(attachment: CardAttachment): Promise<void> {
  const { error } = await supabase.from('card_attachments').delete().eq('id', attachment.id);
  if (error) throw error;
  await deleteCardAttachmentObject(attachment.storage_path).catch(() => {
    // The DB row is gone either way; a leftover object is harmless.
  });
}
