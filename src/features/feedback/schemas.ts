import { z } from 'zod';
import type { FeedbackKind } from '@/types/database';

/**
 * Validation for a feedback / feature-idea submission. This is for UX only — the
 * real guarantees are DB constraints + Row Level Security on the server, which
 * stamps user_id from auth.uid() and only lets a user see their own rows (the
 * admin sees all). Treat all input as untrusted regardless (plan.md §6).
 */

const FEEDBACK_KINDS = ['feedback', 'feature'] as const satisfies readonly FeedbackKind[];

export const feedbackSchema = z.object({
  kind: z.enum(FEEDBACK_KINDS),
  message: z
    .string()
    .trim()
    .min(1, { message: 'Write a little something first.' })
    .max(4000, { message: 'Keep it under 4000 characters.' }),
});

export type FeedbackInput = z.infer<typeof feedbackSchema>;

/**
 * Flatten a ZodError into `{ field: message }`, keeping the first issue per
 * field. Mirrors the helper in the projects/auth features; kept local so the
 * feedback module stays self-contained.
 */
export function fieldErrorsOf(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === 'string' && !(key in out)) out[key] = issue.message;
  }
  return out;
}
