import { supabase } from '@/lib/supabase';

/**
 * Data layer for the Calendar subscribe feed (Pro) — talks to the
 * `calendar-feed-token` Edge Function, which is the only writer of
 * `profiles.calendar_feed_token` (a DB trigger blocks the client from setting
 * it directly). The public `calendar-feed` function then serves the actual
 * ICS file to external calendar apps, unauthenticated, by that token.
 */

interface TokenResponse {
  token?: string | null;
  error?: string;
}

async function invoke(method: 'GET' | 'POST' | 'DELETE', body?: Record<string, unknown>): Promise<string | null> {
  const { data, error } = (await supabase.functions.invoke<TokenResponse>('calendar-feed-token', {
    method,
    body,
  })) as { data: TokenResponse | null; error: Error | null };
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data?.token ?? null;
}

/** The caller's current feed token, or null if the feed has never been turned on. */
export function fetchFeedToken(): Promise<string | null> {
  return invoke('GET');
}

/** Turns the feed on (or returns the existing token if already on). */
export function enableFeed(): Promise<string | null> {
  return invoke('POST', { rotate: false });
}

/** Issues a brand-new token, invalidating any previously shared subscribe URL. */
export function rotateFeedToken(): Promise<string | null> {
  return invoke('POST', { rotate: true });
}

/** Turns the feed off entirely. */
export async function revokeFeedToken(): Promise<void> {
  await invoke('DELETE');
}

/** The full HTTPS subscribe URL a calendar app should be pointed at. */
export function feedUrlForToken(token: string): string {
  const base = import.meta.env.VITE_SUPABASE_URL;
  return `${base}/functions/v1/calendar-feed?token=${token}`;
}
