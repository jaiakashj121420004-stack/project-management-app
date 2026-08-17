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

// `recurrenceRuleSchema` now lives in `@/lib/recurrence` (shared with cards'
// recurrence — see that module's doc comment). Re-exported here so existing
// `from './schemas'` imports in this feature keep working.
export { recurrenceRuleSchema } from '@/lib/recurrence';
