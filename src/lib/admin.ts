import type { User } from '@supabase/supabase-js';

/**
 * The single app administrator (the owner). Only this account can read user
 * feedback and post the "From the CEO" message.
 *
 * The REAL gate is the database `is_admin()` SECURITY DEFINER function used in
 * RLS — this constant only decides which admin-only UI is shown in the browser.
 * Keep the email in sync with the `is_admin()` migration.
 */
export const ADMIN_EMAIL = 'jaiakashj121420004@gmail.com';

/** True when the signed-in user is the app administrator. */
export function isAdminUser(user: User | null | undefined): boolean {
  return Boolean(user?.email) && user!.email!.toLowerCase() === ADMIN_EMAIL;
}
