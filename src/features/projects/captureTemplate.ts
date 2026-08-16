/**
 * captureTemplate.ts — the reverse of instantiateTemplate.ts: turn a live
 * project's current board state into a `ProjectTemplatePayload` snapshot for
 * "save as template". Pure and dependency-light (no Supabase import) so it's
 * trivially unit-testable, mirroring editor/templateDoc.ts's pure-conversion
 * pattern for note templates.
 *
 * A snapshot is a *shape*, not a copy: titles, checklist text, and label
 * name/color travel; due dates, assignees, priorities, comments, review
 * state, time entries, and attachments do not — those are per-instance, not
 * part of a reusable starting point (matches the task brief and
 * PROJECT_TEMPLATES' own scope).
 */
import type { Card, CardLabel, ChecklistItem, Column, Label } from '@/types/database';
import { cardsInColumn, sortColumns } from '@/features/board/ordering';
import { byPosition } from '@/lib/ordering';
import {
  MAX_CARDS_PER_COLUMN,
  MAX_CHECKLIST_ITEMS_PER_CARD,
  MAX_COLUMNS,
  MAX_LABELS_PER_CARD,
  type ProjectTemplatePayload,
} from './templateSchemas';

export interface ProjectBoardSnapshot {
  columns: Column[];
  cards: Card[];
  checklist: ChecklistItem[];
  labels: Label[];
  cardLabels: CardLabel[];
}

/**
 * Build a payload from a project's current board + card extras. Silently
 * truncates to the same caps a template payload is validated against
 * (templateSchemas.ts) rather than erroring on a large real project — a
 * "save as template" action should always succeed for a project, just
 * capturing its first N columns/cards/checklist items/labels.
 */
export function snapshotProjectPayload(snapshot: ProjectBoardSnapshot): ProjectTemplatePayload {
  const { columns, cards, checklist, labels, cardLabels } = snapshot;

  const labelById = new Map(labels.map((label) => [label.id, label]));
  const checklistByCard = new Map<string, ChecklistItem[]>();
  for (const item of checklist) {
    const list = checklistByCard.get(item.card_id);
    if (list) list.push(item);
    else checklistByCard.set(item.card_id, [item]);
  }
  const labelIdsByCard = new Map<string, string[]>();
  for (const link of cardLabels) {
    const list = labelIdsByCard.get(link.card_id);
    if (list) list.push(link.label_id);
    else labelIdsByCard.set(link.card_id, [link.label_id]);
  }

  const orderedColumns = sortColumns(columns).slice(0, MAX_COLUMNS);

  return {
    columns: orderedColumns.map((column) => ({
      name: column.name,
      cards: cardsInColumn(cards, column.id)
        .slice(0, MAX_CARDS_PER_COLUMN)
        .map((card) => {
          const cardChecklist = (checklistByCard.get(card.id) ?? [])
            .sort(byPosition)
            .slice(0, MAX_CHECKLIST_ITEMS_PER_CARD)
            .map((item) => item.text);
          const cardLabelNames = (labelIdsByCard.get(card.id) ?? [])
            .map((labelId) => labelById.get(labelId))
            .filter((label): label is Label => Boolean(label))
            .slice(0, MAX_LABELS_PER_CARD)
            .map((label) => ({ name: label.name, color: label.color }));
          return {
            title: card.title,
            ...(cardChecklist.length > 0 ? { checklist: cardChecklist } : {}),
            ...(cardLabelNames.length > 0 ? { labels: cardLabelNames } : {}),
          };
        }),
    })),
  };
}
