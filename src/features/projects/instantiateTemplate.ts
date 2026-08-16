/**
 * instantiateTemplate.ts — turn a `ProjectTemplatePayload` into real columns,
 * cards, checklist items, and labels inside a (just-created, empty) project.
 *
 * Not a single DB transaction — Supabase's REST layer doesn't expose one from
 * the client — so this runs as a small sequence of batch inserts: columns,
 * then cards, then checklist items + labels together. That mirrors the
 * upload-then-insert / batch patterns already used elsewhere in this codebase
 * (e.g. board/cardExtras.ts's attachment flow). A failure partway through
 * leaves the project with whatever was created so far rather than silently
 * vanishing — a safe, visible failure mode for a brand-new project the user
 * hasn't started relying on yet.
 */
import { supabase } from '@/lib/supabase';
import type { LabelColor } from '@/lib/labelColors';
import { sequentialPositions } from './templatePositions';
import type { ProjectTemplatePayload } from './templateSchemas';

/**
 * Create every column, card, checklist item, and label a template specifies,
 * inside `projectId`. Intended to run immediately after creating a brand-new
 * (empty) project — it does not check for or merge with existing content.
 */
export async function instantiateProjectTemplate(
  projectId: string,
  payload: ProjectTemplatePayload,
): Promise<void> {
  if (payload.columns.length === 0) return;

  // 1. Columns — one batch insert.
  const columnPositions = sequentialPositions(payload.columns.length);
  const { data: insertedColumns, error: columnsError } = await supabase
    .from('columns')
    .insert(
      payload.columns.map((column, index) => ({
        project_id: projectId,
        name: column.name,
        position: columnPositions[index]!,
      })),
    )
    .select('id, position');
  if (columnsError) throw columnsError;

  // Match returned rows back to their template column by position (unique
  // within this batch) rather than assuming insert-return order, which
  // PostgREST doesn't document as guaranteed.
  const columnIdByPosition = new Map(insertedColumns.map((row) => [row.position, row.id]));
  const columnIds = columnPositions.map((position) => columnIdByPosition.get(position)!);

  // 2. Cards — flatten every column's cards into one batch insert.
  interface PendingCard {
    columnIndex: number;
    cardIndex: number;
    position: number;
  }
  const pending: PendingCard[] = [];
  const cardRows: { project_id: string; column_id: string; title: string; position: number }[] = [];
  payload.columns.forEach((column, columnIndex) => {
    const positions = sequentialPositions(column.cards.length);
    column.cards.forEach((card, cardIndex) => {
      const position = positions[cardIndex]!;
      pending.push({ columnIndex, cardIndex, position });
      cardRows.push({
        project_id: projectId,
        column_id: columnIds[columnIndex]!,
        title: card.title,
        position,
      });
    });
  });
  if (cardRows.length === 0) return;

  const { data: insertedCards, error: cardsError } = await supabase
    .from('cards')
    .insert(cardRows)
    .select('id, column_id, position');
  if (cardsError) throw cardsError;

  // (column_id, position) is unique within this batch — same reasoning as the
  // column match above.
  const cardIdByKey = new Map(
    insertedCards.map((row) => [`${row.column_id}:${row.position}`, row.id]),
  );

  // 3. Checklist items + 4. Labels — gathered from every pending card, then
  // each written as one more batch insert.
  const checklistRows: { card_id: string; text: string; position: number }[] = [];
  // Labels are project-scoped and unique by (project_id, name) — see
  // labels_project_name_key — so dedupe by name across the whole template
  // before inserting, keeping the first color seen for a given name.
  const uniqueLabelsByName = new Map<string, LabelColor>();
  const cardLabelRefs: { cardId: string; labelName: string }[] = [];

  for (const { columnIndex, cardIndex, position } of pending) {
    const templateCard = payload.columns[columnIndex]!.cards[cardIndex]!;
    const columnId = columnIds[columnIndex]!;
    const cardId = cardIdByKey.get(`${columnId}:${position}`);
    if (!cardId) continue; // defensive; every card inserted above has a key here

    const checklist = templateCard.checklist ?? [];
    const itemPositions = sequentialPositions(checklist.length);
    checklist.forEach((text, itemIndex) => {
      checklistRows.push({ card_id: cardId, text, position: itemPositions[itemIndex]! });
    });

    for (const label of templateCard.labels ?? []) {
      if (!uniqueLabelsByName.has(label.name)) uniqueLabelsByName.set(label.name, label.color);
      cardLabelRefs.push({ cardId, labelName: label.name });
    }
  }

  const writes: Promise<unknown>[] = [];
  if (checklistRows.length > 0) {
    writes.push(
      (async () => {
        const { error } = await supabase.from('checklist_items').insert(checklistRows);
        if (error) throw error;
      })(),
    );
  }

  if (uniqueLabelsByName.size > 0) {
    const labelRows = Array.from(uniqueLabelsByName, ([name, color]) => ({
      project_id: projectId,
      name,
      color,
    }));
    writes.push(
      (async () => {
        const { data: insertedLabels, error: labelsError } = await supabase
          .from('labels')
          .insert(labelRows)
          .select('id, name');
        if (labelsError) throw labelsError;
        const labelIdByName = new Map(insertedLabels.map((row) => [row.name, row.id]));
        const cardLabelRows = cardLabelRefs
          .map((ref) => ({ card_id: ref.cardId, label_id: labelIdByName.get(ref.labelName) }))
          .filter((row): row is { card_id: string; label_id: string } => Boolean(row.label_id));
        if (cardLabelRows.length === 0) return;
        const { error: cardLabelsError } = await supabase.from('card_labels').insert(cardLabelRows);
        if (cardLabelsError) throw cardLabelsError;
      })(),
    );
  }

  await Promise.all(writes);
}
