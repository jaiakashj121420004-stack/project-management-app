import { z } from 'zod';

/**
 * Validation for collaboration input. UX only — Row Level Security + the DB
 * check constraints (invitations.role, the email CHECK) are the real guarantees
 * (plan.md §6). Email is normalised to lowercase here so it matches the
 * case-insensitive unique index and the redemption lookup.
 */

/** Only editor/viewer are invitable; 'owner' is the project creator alone. */
export const INVITE_ROLES = ['editor', 'viewer'] as const;

export const inviteSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, { message: 'Enter an email address.' })
    .max(255, { message: 'That email is too long.' })
    .refine((value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), {
      message: 'Enter a valid email address.',
    }),
  role: z.enum(INVITE_ROLES),
});

export type InviteInput = z.infer<typeof inviteSchema>;

/** First Zod issue per field, as `{ field: message }`. */
export function fieldErrorsOf(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === 'string' && !(key in out)) out[key] = issue.message;
  }
  return out;
}
