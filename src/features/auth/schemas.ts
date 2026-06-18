import { z } from 'zod';

/**
 * Zod schemas for every auth form. Validation here is for UX only — the real
 * guarantees are Supabase Auth + Row Level Security on the server (plan.md §6).
 * Treat all input as untrusted regardless.
 */

const email = z.email({ message: 'Enter a valid email address.' }).trim();

const password = z
  .string()
  .min(8, { message: 'Use at least 8 characters.' })
  .max(72, { message: 'Passwords can be at most 72 characters.' }); // bcrypt limit

const displayName = z
  .string()
  .trim()
  .min(2, { message: 'Use at least 2 characters.' })
  .max(60, { message: 'Keep it under 60 characters.' });

export const signUpSchema = z.object({
  displayName,
  email,
  password,
});
export type SignUpInput = z.infer<typeof signUpSchema>;

export const loginSchema = z.object({
  email,
  // Don't reveal password rules on login — just require something.
  password: z.string().min(1, { message: 'Enter your password.' }),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({ email });
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    password,
    confirmPassword: z.string(),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  });
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const profileSchema = z.object({ displayName });
export type ProfileInput = z.infer<typeof profileSchema>;

/**
 * Flatten a ZodError into `{ field: message }`, keeping the first issue per
 * field. Avoids version-specific flatten helpers so it's stable across Zod
 * releases.
 */
export function fieldErrorsOf(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === 'string' && !(key in out)) out[key] = issue.message;
  }
  return out;
}
