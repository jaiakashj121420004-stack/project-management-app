import { z } from 'zod';

/** Validation for the daily to-do feature (shared by lists and items). */

export const todoListNameSchema = z
  .string()
  .trim()
  .min(1, 'Name your list.')
  .max(60, 'Keep the name under 60 characters.');

export const todoItemTextSchema = z
  .string()
  .trim()
  .min(1, 'Add some text.')
  .max(500, 'Keep it under 500 characters.');

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date.');

/** Mirrors `RecurrenceRule` in recurrence.ts — validated client-side before it
 *  ever reaches the DB (the `enforce_recurrence_plan` trigger is the real gate). */
export const recurrenceRuleSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('daily') }),
  z.object({
    type: z.literal('weekly'),
    weekdays: z.array(z.number().int().min(0).max(6)).min(1, 'Pick at least one day.'),
  }),
  z.object({
    type: z.literal('monthly'),
    day: z.union([z.number().int().min(1).max(31), z.literal('last')]),
  }),
  z.object({
    type: z.literal('interval'),
    unit: z.enum(['day', 'week', 'month']),
    count: z.number().int().min(1).max(365),
    anchor: isoDateSchema,
  }),
]);
