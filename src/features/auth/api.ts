import { AuthError } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { LoginInput, SignUpInput } from './schemas';

/** Where OAuth and password-reset links return to. Must be allow-listed in
 *  Supabase → Auth → URL Configuration → Redirect URLs. */
const origin = () => window.location.origin;

export interface AuthResult {
  error: string | null;
}

export interface SignUpResult extends AuthResult {
  /** True when email confirmation is on, so no session was created yet. */
  needsConfirmation: boolean;
}

/** Turn a Supabase AuthError into something safe and friendly for the UI. */
export function friendlyAuthError(error: unknown): string {
  if (!(error instanceof AuthError)) {
    return 'Something went wrong. Please try again.';
  }
  const message = error.message.toLowerCase();
  if (message.includes('invalid login credentials')) {
    return "That email or password doesn't match our records.";
  }
  if (message.includes('email not confirmed')) {
    return 'Please confirm your email first — check your inbox for the link.';
  }
  if (message.includes('already registered') || message.includes('already been registered')) {
    return 'An account with this email already exists. Try logging in instead.';
  }
  if (message.includes('for security purposes') || message.includes('rate limit')) {
    return 'Too many attempts. Please wait a moment and try again.';
  }
  // Surface the provider's wording as a last resort; it's already user-facing.
  return error.message;
}

export async function signUpWithEmail({
  displayName,
  email,
  password,
}: SignUpInput): Promise<SignUpResult> {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // Picked up by the handle_new_user() trigger to seed profiles.display_name.
      data: { display_name: displayName, full_name: displayName },
      emailRedirectTo: origin(),
    },
  });
  if (error) return { error: friendlyAuthError(error), needsConfirmation: false };
  return { error: null, needsConfirmation: !data.session };
}

export async function signInWithEmail({ email, password }: LoginInput): Promise<AuthResult> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  return { error: error ? friendlyAuthError(error) : null };
}

export async function signInWithGoogle(): Promise<AuthResult> {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: origin() },
  });
  // On success the browser navigates away, so this only returns on error.
  return { error: error ? friendlyAuthError(error) : null };
}

export async function sendPasswordReset(email: string): Promise<AuthResult> {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin()}/reset-password`,
  });
  return { error: error ? friendlyAuthError(error) : null };
}

export async function updatePassword(password: string): Promise<AuthResult> {
  const { error } = await supabase.auth.updateUser({ password });
  return { error: error ? friendlyAuthError(error) : null };
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}
