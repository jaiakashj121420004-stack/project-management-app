import { z } from 'zod';
import { LABEL_COLOR_NAMES, type LabelColor } from '@/lib/labelColors';
import {
  cardTitleSchema,
  checklistItemTextSchema,
  columnNameSchema,
  labelNameSchema,
} from '@/features/board/schemas';

/**
 * Zod validation for a parsed import (Trello JSON or CSV → this shape, before
 * `runImport.ts` writes it). Deliberately much more generous than
 * `projects/templateSchemas.ts` (MAX_COLUMNS=10, MAX_CARDS_PER_COLUMN=30,
 * …) — a template is a curated starter shape, this is a one-time migration of
 * someone's real board, which can legitimately be large. Still finite so a
 * malformed or pathological file can't hang the browser or produce an
 * unusably huge project; `trelloParser.ts`/`csvParser.ts` truncate/cap to
 * these limits themselves (with a note in the summary) rather than letting
 * `safeParse` reject the whole import over one oversized field.
 */
export const IMPORT_MAX_COLUMNS = 200;
export const IMPORT_MAX_CARDS = 5000;
export const IMPORT_MAX_CHECKLIST_ITEMS_PER_CARD = 100;
export const IMPORT_MAX_LABELS_PER_CARD = 20;
/** Read client-side with `File.text()` — generous but bounded so a huge
 *  accidental upload doesn't freeze the tab trying to parse it. */
export const IMPORT_MAX_FILE_BYTES = 25 * 1024 * 1024;

export const importCardLabelSchema = z.object({
  name: labelNameSchema,
  color: z.enum(LABEL_COLOR_NAMES as [LabelColor, ...LabelColor[]]),
});

export const importChecklistItemSchema = z.object({
  text: checklistItemTextSchema,
  done: z.boolean(),
});

export const importCardSchema = z.object({
  title: cardTitleSchema,
  description: z.string().trim().max(5000).nullable(),
  // ISO date (YYYY-MM-DD) — mirrors cards.due_date (database.ts).
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
  // Full instant (timestamptz), only ever set from a Trello card's `due` —
  // CSV import has no time component, so this is always null there.
  dueAt: z.string().nullable(),
  labels: z.array(importCardLabelSchema).max(IMPORT_MAX_LABELS_PER_CARD),
  checklist: z.array(importChecklistItemSchema).max(IMPORT_MAX_CHECKLIST_ITEMS_PER_CARD),
});

export const importColumnSchema = z.object({
  name: columnNameSchema,
  cards: z.array(importCardSchema),
});

export const importPayloadSchema = z
  .object({
    projectName: z
      .string()
      .trim()
      .min(1, 'Give the imported project a name.')
      .max(80, 'Keep it under 80 characters.'),
    columns: z
      .array(importColumnSchema)
      .min(1, 'No columns found to import.')
      .max(IMPORT_MAX_COLUMNS),
  })
  .refine(
    (payload) =>
      payload.columns.reduce((sum, column) => sum + column.cards.length, 0) <= IMPORT_MAX_CARDS,
    { message: `An import can bring in at most ${IMPORT_MAX_CARDS} cards.` },
  );

export type ImportCardLabel = z.infer<typeof importCardLabelSchema>;
export type ImportChecklistItem = z.infer<typeof importChecklistItemSchema>;
export type ImportCard = z.infer<typeof importCardSchema>;
export type ImportColumn = z.infer<typeof importColumnSchema>;
export type ImportPayload = z.infer<typeof importPayloadSchema>;

/** The result of parsing a file into an `ImportPayload` — `notes` is the
 *  "what didn't come along" summary shown before AND after the import runs
 *  (see the task brief: never silently drop something Aurora can't model). */
export interface ParsedImport {
  payload: ImportPayload;
  notes: string[];
}
