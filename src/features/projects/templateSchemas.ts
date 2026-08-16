/**
 * templateSchemas.ts — Zod validation for project templates (curated system
 * templates AND user "save as template" saves share this exact payload
 * shape — see projectTemplates.ts's comment).
 *
 * Mirrors the DB constraints in 20260816170000_project_templates.sql, and
 * reuses the board feature's own field validators (columnNameSchema,
 * cardTitleSchema, checklistItemTextSchema, labelNameSchema) so a template's
 * column/card/checklist/label text can never violate the same DB checks that
 * gate creating them directly on a board.
 */
import { z } from 'zod';
import { LABEL_COLOR_NAMES, type LabelColor } from '@/lib/labelColors';
import {
  cardTitleSchema,
  checklistItemTextSchema,
  columnNameSchema,
  labelNameSchema,
} from '@/features/board/schemas';

/** Generous but finite caps — a "starter" template, not a full project import.
 *  Keeps a pathological payload (or a hand-crafted API call) from creating an
 *  unusably huge board in one shot. Exported so captureTemplate.ts's "save as
 *  template" snapshot can truncate a large real project to the same limits
 *  instead of duplicating the numbers. */
export const MAX_COLUMNS = 10;
export const MAX_CARDS_PER_COLUMN = 30;
export const MAX_CHECKLIST_ITEMS_PER_CARD = 20;
export const MAX_LABELS_PER_CARD = 6;

export const templateCardLabelSchema = z.object({
  name: labelNameSchema,
  color: z.enum(LABEL_COLOR_NAMES as [LabelColor, ...LabelColor[]]),
});

export const templateCardSchema = z.object({
  title: cardTitleSchema,
  checklist: z.array(checklistItemTextSchema).max(MAX_CHECKLIST_ITEMS_PER_CARD).optional(),
  labels: z.array(templateCardLabelSchema).max(MAX_LABELS_PER_CARD).optional(),
});

export const templateColumnSchema = z.object({
  name: columnNameSchema,
  cards: z.array(templateCardSchema).max(MAX_CARDS_PER_COLUMN),
});

/** { columns: [{ name, cards: [{ title, checklist?, labels? }] }] } — the one
 *  shape shared by every curated system template AND every user-saved one. */
export const projectTemplatePayloadSchema = z.object({
  columns: z.array(templateColumnSchema).min(1, 'A template needs at least one column.').max(
    MAX_COLUMNS,
  ),
});

export type ProjectTemplatePayload = z.infer<typeof projectTemplatePayloadSchema>;
export type TemplateColumnPayload = z.infer<typeof templateColumnSchema>;
export type TemplateCardPayload = z.infer<typeof templateCardSchema>;
export type TemplateCardLabelPayload = z.infer<typeof templateCardLabelSchema>;

export const templateNameSchema = z
  .string()
  .trim()
  .min(1, 'Give the template a name.')
  .max(80, 'Keep it under 80 characters.');

export const templateDescriptionSchema = z
  .string()
  .trim()
  .max(200, 'Keep it under 200 characters.');

/** A single emoji (or empty/absent) — matches EmojiPicker's output exactly. */
export const templateIconSchema = z.string().trim().max(8).nullish();

/** Validated input for "Save as template". */
export const projectTemplateInputSchema = z.object({
  name: templateNameSchema,
  description: templateDescriptionSchema.optional(),
  icon: templateIconSchema,
  payload: projectTemplatePayloadSchema,
});

export type ProjectTemplateInput = z.infer<typeof projectTemplateInputSchema>;

/** Defensively parse a stored `project_templates.payload` (jsonb, typed
 *  loosely as `Record<string, unknown>` in database.ts) back into a real
 *  `ProjectTemplatePayload` — every row this app writes already passed this
 *  same schema on insert, so this should always succeed; `null` on a
 *  malformed row lets the UI skip it instead of crashing. */
export function parseTemplatePayload(raw: unknown): ProjectTemplatePayload | null {
  const parsed = projectTemplatePayloadSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

/** First Zod issue per field, as `{ field: message }` — mirrors the helper in
 *  board/schemas.ts and projects/schemas.ts. */
export function fieldErrorsOf(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === 'string' && !(key in out)) out[key] = issue.message;
  }
  return out;
}
