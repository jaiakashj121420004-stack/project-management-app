// Aurora — Stripe Billing Portal session creator (Phase 10, billing).
//
// Authenticated endpoint. A Pro user calls this to manage their subscription
// (update card, view invoices, cancel). We hand Stripe's hosted portal the
// user's existing customer id and return the URL to redirect to.
//
// This file runs on Deno (Supabase Edge Runtime), NOT in the Vite app bundle —
// it is excluded from the app's TypeScript/ESLint config on purpose.
//
// Required secrets (set with `supabase secrets set`, never committed):
//   STRIPE_SECRET_KEY — Stripe secret API key (sk_...)
//   APP_URL           — site origin the portal returns the user to
// Provided automatically by the Edge runtime: SUPABASE_URL,
// SUPABASE_SERVICE_ROLE_KEY.

import Stripe from 'npm:stripe@^17';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY')!;
const APP_URL = Deno.env.get('APP_URL')!;

// Stripe must use the Fetch HTTP client on Deno; the default Node client can't run here.
const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
});

// Browsers call this cross-origin, so every response carries CORS headers.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

interface AuthedUser {
  id: string;
  email: string | null;
}

/**
 * Resolve the caller from their bearer JWT via Supabase Auth. Returns null when
 * the token is missing or invalid so the handler can reject with 401.
 */
async function getAuthedUser(req: Request): Promise<AuthedUser | null> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const jwt = authHeader.slice('Bearer '.length);

  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${jwt}` },
  });
  if (!res.ok) return null;
  const user = (await res.json()) as { id?: string; email?: string | null };
  if (!user.id) return null;
  return { id: user.id, email: user.email ?? null };
}

/** Read a single profile row with the service role (bypasses RLS). */
async function getProfile(userId: string): Promise<{ stripe_customer_id: string | null } | null> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=stripe_customer_id`,
    { headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}` } },
  );
  if (!res.ok) throw new Error(`Profile lookup failed: ${res.status} ${await res.text()}`);
  const rows = (await res.json()) as Array<{ stripe_customer_id: string | null }>;
  return rows[0] ?? null;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const user = await getAuthedUser(req);
    if (!user) return json({ error: 'Unauthorized' }, 401);

    const profile = await getProfile(user.id);
    const customerId = profile?.stripe_customer_id;
    // No Stripe customer means the user has never started checkout — there is
    // nothing to manage yet.
    if (!customerId) return json({ error: 'No billing account yet.' }, 400);

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${APP_URL}/billing`,
    });

    return json({ url: session.url });
  } catch (err) {
    console.error(err);
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
