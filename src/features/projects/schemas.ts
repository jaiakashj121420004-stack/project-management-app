import { z } from 'zod';
import { ACCENT_NAMES, type AccentName } from '@/lib/accents';

/**
 * Zod schema for the project create/edit form. Validation here is for UX only —
 * the real guarantees are DB check constraints + Row Level Security on the
 * server (plan.md §6). Treat all input as untrusted regardless.
 */
export const projectFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { message: 'Give your project a name.' })
    .max(80, { message: 'Keep it under 80 characters.' }),
  description: z
    .string()
    .trim()
    .max(500, { message: 'Keep it under 500 characters.' }),
  // A tuple cast is required because z.enum wants string literals; ACCENT_NAMES
  // is the single source of truth for the six valid accents (plan.md §4.2).
  accent: z.enum(ACCENT_NAMES as [AccentName, ...AccentName[]]),
});

export type ProjectFormInput = z.infer<typeof projectFormSchema>;

/**
 * Flatten a ZodError into `{ field: message }`, keeping the first issue per
 * field. Mirrors the helper in the auth feature; kept local so the projects
 * module stays self-contained.
 */
export function fieldErrorsOf(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === 'string' && !(key in out)) out[key] = issue.message;
  }
  return out;
}
