import { z } from 'zod';

/**
 * Zod schemas for the goal create/edit form (Task 24 — simple goals, not
 * enterprise OKRs). Validation here is UX only — the real guarantees are the
 * DB CHECK constraints (`goals_progress_shape`) + Row Level Security on the
 * server (plan.md §6, 20260820120000_goals.sql). Deliberately just three
 * fields: title, an optional target date, and one of two progress modes — no
 * more, per Task 24's own instruction and guardrail item 4 ("if it can't be
 * explained in one plain sentence, it's over-scoped"). The `goals` table also
 * carries an optional `description`, but the create/edit form never exposes
 * it — it stays available for a future affordance without growing this form.
 */

export const GOAL_PROGRESS_TYPES = ['linked_checklist', 'manual_percent'] as const;
export type GoalProgressTypeInput = (typeof GOAL_PROGRESS_TYPES)[number];

/** A single goal as the create/edit form holds it. `linkedCardId`/`manualPercent`
 *  are mutually exclusive by `progressType` (superRefine below) — only the one
 *  matching the chosen mode is required. */
export const goalFormSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, { message: 'Give this goal a title.' })
      .max(120, { message: 'Keep it under 120 characters.' }),
    // 'YYYY-MM-DD', or null for "no target date".
    targetDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable(),
    progressType: z.enum(GOAL_PROGRESS_TYPES),
    manualPercent: z.number().int().min(0).max(100).nullable(),
    linkedCardId: z.string().uuid().nullable(),
  })
  .superRefine((value, ctx) => {
    if (value.progressType === 'manual_percent' && value.manualPercent === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['manualPercent'],
        message: 'Set a percentage for this goal.',
      });
    }
    if (value.progressType === 'linked_checklist' && value.linkedCardId === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['linkedCardId'],
        message: 'Choose a card whose checklist should drive this goal.',
      });
    }
  });

export type GoalFormInput = z.infer<typeof goalFormSchema>;

/** First Zod issue per field, as `{ field: message }` — same shape as
 *  projects/schemas.ts's fieldErrorsOf and automations/schemas.ts's twin. */
export function fieldErrorsOf(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === 'string' && !(key in out)) out[key] = issue.message;
  }
  return out;
}
