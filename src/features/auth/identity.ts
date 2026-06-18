import type { User } from '@supabase/supabase-js';
import type { Profile } from '@/types/database';

/** Safely read a string field from the untyped user_metadata bag. */
function metaString(user: User | null | undefined, key: string): string | undefined {
  const value: unknown = user?.user_metadata?.[key];
  return typeof value === 'string' && value.trim() ? value : undefined;
}

/**
 * Best display name available: the chosen profile name, then the OAuth/provider
 * name, then the email's local part. Always returns something printable.
 */
export function resolveDisplayName(
  profile: Profile | null | undefined,
  user: User | null | undefined,
): string {
  return (
    profile?.display_name?.trim() ||
    metaString(user, 'full_name') ||
    metaString(user, 'name') ||
    user?.email?.split('@')[0] ||
    'You'
  );
}

/** Profile avatar if set, else the provider-supplied image, else null. */
export function resolveAvatarUrl(
  profile: Profile | null | undefined,
  user: User | null | undefined,
): string | null {
  return profile?.avatar_url || metaString(user, 'avatar_url') || metaString(user, 'picture') || null;
}
