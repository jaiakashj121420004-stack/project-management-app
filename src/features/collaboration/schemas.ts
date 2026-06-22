import { z } from 'zod';

/**
 * Validation for collaboration input. UX only — Row Level Security + the DB
 * check constraints (comments.body length, reactions.emoji, the review_status
 * enum) are the real guarantees (plan.md §6).
 */
export const commentSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, { message: 'Write a comment first.' })
    .max(5000, { message: 'That comment is too long (5000 characters max).' }),
});

export type CommentInput = z.infer<typeof commentSchema>;
