import { z } from 'zod';

/**
 * Zod schemas for automation rule input (Pro/Team, Task 23). Validation here is
 * UX only — the real guarantees are the DB CHECK constraints, the
 * validate_automation_rule_targets trigger, and RLS on the server (plan.md §6,
 * 20260817140000_automation_rules.sql). Deliberately a closed set of
 * trigger/action shapes, not an open builder — see reports/SIMPLICITY-GUARDRAIL.md
 * item 6 and memory.md's decision log for why this stays this small on purpose.
 */

export const AUTOMATION_TRIGGER_TYPES = [
  'card_moved_to_column',
  'checklist_completed',
  'due_date_passed',
] as const;
export type AutomationTriggerTypeInput = (typeof AUTOMATION_TRIGGER_TYPES)[number];

export const AUTOMATION_ACTION_TYPES = ['move_to_column', 'add_label', 'assign_user'] as const;
export type AutomationActionTypeInput = (typeof AUTOMATION_ACTION_TYPES)[number];

const uuidSchema = z.string().uuid();

/** One rule as the create/edit form holds it — a flat shape, not yet split into
 *  trigger_config/action_config jsonb (see `toRuleConfigs` in api.ts). Absent
 *  target fields (e.g. no column picked yet for a move-to-column trigger) fail
 *  validation rather than silently defaulting, so a half-filled rule can never
 *  be saved. */
export const automationRuleInputSchema = z
  .object({
    triggerType: z.enum(AUTOMATION_TRIGGER_TYPES),
    triggerColumnId: uuidSchema.nullable(),
    actionType: z.enum(AUTOMATION_ACTION_TYPES),
    actionColumnId: uuidSchema.nullable(),
    actionLabelId: uuidSchema.nullable(),
    // Explicit tri-state: undefined = "not chosen yet" (invalid), null = "assign
    // to nobody" (valid, a real unassign action), a uuid = a specific member.
    actionUserId: uuidSchema.nullable().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.triggerType === 'card_moved_to_column' && !value.triggerColumnId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['triggerColumnId'],
        message: 'Choose which column starts this automation.',
      });
    }
    if (value.actionType === 'move_to_column' && !value.actionColumnId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['actionColumnId'],
        message: 'Choose a column to move the card to.',
      });
    }
    if (value.actionType === 'add_label' && !value.actionLabelId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['actionLabelId'],
        message: 'Choose a label to add.',
      });
    }
    if (value.actionType === 'assign_user' && value.actionUserId === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['actionUserId'],
        message: 'Choose who to assign (or "Nobody" to unassign).',
      });
    }
  });

export type AutomationRuleInput = z.infer<typeof automationRuleInputSchema>;

/** First Zod issue per field, as `{ field: message }` — same shape as
 *  board/schemas.ts's fieldErrorsOf. */
export function fieldErrorsOf(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === 'string' && !(key in out)) out[key] = issue.message;
  }
  return out;
}
