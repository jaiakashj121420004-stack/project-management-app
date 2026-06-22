import { supabase } from '@/lib/supabase';
import type { BillingInterval } from '@/lib/plans';

/**
 * Billing data layer. These call the Dodo Payments Edge Functions, which run
 * with the service role; the verified Dodo webhook is the ONLY thing that may
 * change a user's plan — the browser never sets `profiles.plan` itself (a DB
 * trigger forbids it). Each function returns a URL we redirect the browser to
 * (Dodo Checkout / customer portal).
 */

interface UrlResponse {
  url?: string;
  error?: string;
}

async function invokeForUrl(
  fn: 'dodo-create-checkout' | 'dodo-portal',
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
 * Start a Dodo Checkout session for the Pro plan at the chosen billing interval
 * (monthly or yearly); resolves to its URL. The Edge Function maps the interval
 * to the right Dodo product.
 */
export function createCheckoutUrl(interval: BillingInterval = 'month'): Promise<string> {
  return invokeForUrl('dodo-create-checkout', { interval });
}

/** Open the Dodo customer portal for the current customer; resolves to its URL. */
export function createPortalUrl(): Promise<string> {
  return invokeForUrl('dodo-portal');
}
