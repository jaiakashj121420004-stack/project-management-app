import { supabase } from '@/lib/supabase';
import { positionForIndex } from '@/lib/ordering';
import type { LabelColor } from '@/lib/labelColors';
import type { ImportPayload } from './schemas';

/**
 * runImport.ts — write a parsed `ImportPayload` into a (just-created, empty)
 * project through the SAME authenticated Supabase calls every other creation
 * flow in this app uses (`board/api.ts`, `projects/api.ts`,
 * `instantiateTemplate.ts`) — plain `supabase.from(...).insert(...)` calls
 * governed by Row Level Security, never a service-role bypass. There is no
 * single-transaction option from the client (Supabase's REST layer doesn't
 * expose one), so — mirroring `instantiateTemplate.ts` — this runs as a
 * sequence of batch inserts: columns, then cards (chunked for large boards),
 * then checklist items + labels. A failure partway through leaves whatever
 * was created so far rather than silently vanishing.
 */

/** Fresh, evenly-spaced fractional positions for `count` appended rows — the
 *  same primitive `projects/templatePositions.ts` uses for template seeding
 *  (`positionForIndex`/`positionBetween` from `lib/ordering.ts`), duplicated
 *  locally rather than imported cross-feature since the import path is
 *  otherwise fully independent of the template system. */
function sequentialPositions(count: number): number[] {
  const placed: { position: number }[] = [];
  for (let index = 0; index < count; index += 1) {
    placed.push({ position: positionForIndex(placed, placed.length) });
  }
  return placed.map((item) => item.position);
}

function toChunks<T>(rows: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < rows.length; i += size) chunks.push(rows.slice(i, i + size));
  return chunks;
}

// A large board (hundreds/thousands of cards) is sent as several smaller
// requests instead of one giant insert — friendlier to PostgREST's request
// size limits and lets `onProgress` report real movement between chunks.
const CARD_CHUNK_SIZE = 300;
const WRITE_CHUNK_SIZE = 500;

export interface ImportProgress {
  /** 0–1. */
  fraction: number;
  label: string;
}

export interface ImportResult {
  columns: number;
  cards: number;
  checklistItems: number;
  labels: number;
}

/**
 * Insert every column, card, checklist item, and label an `ImportPayload`
 * specifies, inside `projectId`. Intended to run immediately after creating a
 * brand-new (empty) project — it does not check for or merge with existing
 * content. `onProgress` fires between batches so the UI can show a real
 * progress bar instead of an indeterminate spinner (large-board imports can
 * take several seconds).
 */
export async function runImport(
  projectId: string,
  payload: ImportPayload,
  onProgress?: (progress: ImportProgress) => void,
): Promise<ImportResult> {
  const totalCards = payload.columns.reduce((sum, column) => sum + column.cards.length, 0);
  const cardChunkCount = Math.max(1, Math.ceil(totalCards / CARD_CHUNK_SIZE));
  // Weighted step count for the progress bar: 1 for columns, one per card
  // chunk, one for checklist items, one for labels.
  const totalSteps = 1 + cardChunkCount + 2;
  let stepsDone = 0;
  function report(label: string): void {
    stepsDone += 1;
    onProgress?.({ fraction: Math.min(stepsDone / totalSteps, 1), label });
  }

  if (payload.columns.length === 0) {
    onProgress?.({ fraction: 1, label: 'Done' });
    return { columns: 0, cards: 0, checklistItems: 0, labels: 0 };
  }

  // 1. Columns — one batch insert.
  report('Creating columns…');
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

  // Match returned rows back to their payload column by position (unique
  // within this batch) rather than assuming insert-return order.
  const columnIdByPosition = new Map(insertedColumns.map((row) => [row.position, row.id]));
  const columnIds = columnPositions.map((position) => columnIdByPosition.get(position)!);

  if (totalCards === 0) {
    onProgress?.({ fraction: 1, label: 'Done' });
    return {
      columns: payload.columns.length,
      cards: 0,
      checklistItems: 0,
      labels: 0,
    };
  }

  // 2. Cards — flattened across every column, written in chunks.
  interface PendingCard {
    columnIndex: number;
    cardIndex: number;
    position: number;
  }
  const pending: PendingCard[] = [];
  const cardRows: {
    project_id: string;
    column_id: string;
    title: string;
    description: string | null;
    due_date: string | null;
    due_at: string | null;
    position: number;
  }[] = [];
  payload.columns.forEach((column, columnIndex) => {
    const positions = sequentialPositions(column.cards.length);
    column.cards.forEach((card, cardIndex) => {
      const position = positions[cardIndex]!;
      pending.push({ columnIndex, cardIndex, position });
      cardRows.push({
        project_id: projectId,
        column_id: columnIds[columnIndex]!,
        title: card.title,
        description: card.description,
        due_date: card.dueDate,
        due_at: card.dueAt,
        position,
      });
    });
  });

  const insertedCards: { id: string; column_id: string; position: number }[] = [];
  for (const chunk of toChunks(cardRows, CARD_CHUNK_SIZE)) {
    const { data, error } = await supabase
      .from('cards')
      .insert(chunk)
      .select('id, column_id, position');
    if (error) throw error;
    insertedCards.push(...data);
    report('Adding cards…');
  }

  // (column_id, position) is unique within this run — same reasoning as the
  // column match above.
  const cardIdByKey = new Map(
    insertedCards.map((row) => [`${row.column_id}:${row.position}`, row.id]),
  );

  // 3. Checklist items + 4. Labels — gathered from every pending card.
  const checklistRows: {
    card_id: string;
    text: string;
    is_done: boolean;
    position: number;
  }[] = [];
  // Labels are project-scoped and unique by (project_id, name) — dedupe by
  // name across the whole payload before inserting, keeping the first color
  // seen for a given name (mirrors instantiateTemplate.ts).
  const uniqueLabelsByName = new Map<string, LabelColor>();
  const cardLabelRefs: { cardId: string; labelName: string }[] = [];

  for (const { columnIndex, cardIndex, position } of pending) {
    const importCard = payload.columns[columnIndex]!.cards[cardIndex]!;
    const columnId = columnIds[columnIndex]!;
    const cardId = cardIdByKey.get(`${columnId}:${position}`);
    if (!cardId) continue; // defensive; every inserted card has a key here

    const itemPositions = sequentialPositions(importCard.checklist.length);
    importCard.checklist.forEach((item, itemIndex) => {
      checklistRows.push({
        card_id: cardId,
        text: item.text,
        is_done: item.done,
        position: itemPositions[itemIndex]!,
      });
    });

    for (const label of importCard.labels) {
      if (!uniqueLabelsByName.has(label.name)) uniqueLabelsByName.set(label.name, label.color);
      cardLabelRefs.push({ cardId, labelName: label.name });
    }
  }

  for (const chunk of toChunks(checklistRows, WRITE_CHUNK_SIZE)) {
    const { error } = await supabase.from('checklist_items').insert(chunk);
    if (error) throw error;
  }
  report('Adding checklist items…');

  let insertedLabelCount = 0;
  if (uniqueLabelsByName.size > 0) {
    const labelRows = Array.from(uniqueLabelsByName, ([name, color]) => ({
      project_id: projectId,
      name,
      color,
    }));
    const { data: insertedLabels, error: labelsError } = await supabase
      .from('labels')
      .insert(labelRows)
      .select('id, name');
    if (labelsError) throw labelsError;
    insertedLabelCount = insertedLabels.length;

    const labelIdByName = new Map(insertedLabels.map((row) => [row.name, row.id]));
    const cardLabelRows = cardLabelRefs
      .map((ref) => ({
        card_id: ref.cardId,
        label_id: labelIdByName.get(ref.labelName),
      }))
      .filter((row): row is { card_id: string; label_id: string } => Boolean(row.label_id));
    for (const chunk of toChunks(cardLabelRows, WRITE_CHUNK_SIZE)) {
      const { error } = await supabase.from('card_labels').insert(chunk);
      if (error) throw error;
    }
  }
  report('Adding labels…');
  onProgress?.({ fraction: 1, label: 'Done' });

  return {
    columns: payload.columns.length,
    cards: insertedCards.length,
    checklistItems: checklistRows.length,
    labels: insertedLabelCount,
  };
}
