import { z } from 'zod';

/**
 * Zod schemas for board input. Validation here is UX only — the real guarantees
 * are the DB check constraints + Row Level Security on the server (plan.md §6).
 * Limits mirror the migration (columns.name ≤ 60, cards.title ≤ 200,
 * cards.description ≤ 5000).
 */

export const columnNameSchema = z
  .string()
  .trim()
  .min(1, { message: 'Give the column a name.' })
  .max(60, { message: 'Keep it under 60 characters.' });

export const cardTitleSchema = z
  .string()
  .trim()
  .min(1, { message: 'Give the card a title.' })
  .max(200, { message: 'Keep it under 200 characters.' });

export const cardDetailSchema = z.object({
  title: cardTitleSchema,
  description: z
    .string()
    .trim()
    .max(5000, { message: 'Keep it under 5000 characters.' }),
});

export type CardDetailInput = z.infer<typeof cardDetailSchema>;

/** First Zod issue per field, as `{ field: message }`. */
export function fieldErrorsOf(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === 'string' && !(key in out)) out[key] = issue.message;
  }
  return out;
}
