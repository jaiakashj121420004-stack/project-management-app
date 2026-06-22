import { supabase } from '@/lib/supabase';
import type { BillingInterval } from '@/lib/plans';

/**
 * Billing data layer. These call the Stripe Edge Functions, which run with the
 * service role and are the ONLY thing that may change a user's plan — the
 * browser never sets `profiles.plan` itself (a DB trigger forbids it). Each
 * function returns a URL we redirect the browser to (Stripe Checkout / Portal).
 */

interface UrlResponse {
  url?: string;
  error?: string;
}

async function invokeForUrl(
  fn: 'create-checkout-session' | 'create-portal-session',
  body: Record<string, unknown> = {},
): Promise<string> {
  // supabase-js attaches the signed-in user's JWT, which the function verifies.
  const { data, error } = (await supabase.functions.invoke<UrlResponse>(fn, { body })) as {
    data: UrlResponse | null;
    error: Error | null;
  };
  if (error) throw error;
  if (!data?.url) throw new Error(data?.error ?? 'No redirect URL was returned.');
  return data.url;
}

/**
 * Start a Stripe Checkout session for the Pro plan at the chosen billing
 * interval (monthly or yearly); resolves to its URL. The Edge Function maps the
 * interval to the right Stripe Price.
 */
export function createCheckoutUrl(interval: BillingInterval = 'month'): Promise<string> {
  return invokeForUrl('create-checkout-session', { interval });
}

/** Open the Stripe billing portal for the current customer; resolves to its URL. */
export function createPortalUrl(): Promise<string> {
  return invokeForUrl('create-portal-session');
}
