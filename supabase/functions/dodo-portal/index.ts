// Aurora — Dodo Payments customer-portal session creator (billing).
//
// Authenticated endpoint. A Pro user calls this to manage their subscription
// (update card, view invoices, cancel). We ask Dodo for a hosted customer-portal
// session for the user's stored customer id and return the URL to redirect to.
//
// This file runs on Deno (Supabase Edge Runtime), NOT in the Vite app bundle —
// it is excluded from the app's TypeScript/ESLint config on purpose.
//
// Required secrets (set with `supabase secrets set`, never committed):
//   DODO_PAYMENTS_API_KEY     — Dodo secret API key (sent as a Bearer token)
//   APP_URL                   — site origin the portal returns the user to
//   DODO_PAYMENTS_ENVIRONMENT — 'test' (default) or 'live'; selects the API base
// Provided automatically by the Edge runtime: SUPABASE_URL,
// SUPABASE_SERVICE_ROLE_KEY.

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const DODO_API_KEY = Deno.env.get('DODO_PAYMENTS_API_KEY')!;
const APP_URL = Deno.env.get('APP_URL')!;

// Defaults to test mode; set DODO_PAYMENTS_ENVIRONMENT=live for production.
const DODO_BASE = (Deno.env.get('DODO_PAYMENTS_ENVIRONMENT') ?? 'test')
  .toLowerCase()
  .startsWith('live')
  ? 'https://live.dodopayments.com'
  : 'https://test.dodopayments.com';

// Browsers call this cross-origin from the app only, so CORS is scoped to
// APP_URL (not '*'). `Vary: Origin` keeps caches from mixing origins.
const corsHeaders = {
  'Access-Control-Allow-Origin': APP_URL,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  Vary: 'Origin',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Best-effort per-user rate limiting (see dodo-create-checkout for the rationale;
// state is per-isolate, fails open, keyed by Supabase user id).
const RATE_LIMIT_MAX = 8;
const RATE_LIMIT_WINDOW_MS = 60_000;
const rateHits = new Map<string, number[]>();

/** True when the user is over the limit; records this hit otherwise. */
function isRateLimited(userId: string): boolean {
  const now = Date.now();
  const recent = (rateHits.get(userId) ?? []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (recent.length >= RATE_LIMIT_MAX) {
    rateHits.set(userId, recent);
    return true;
  }
  recent.push(now);
  rateHits.set(userId, recent);
  return false;
}

/**
 * Resolve the caller's id from their bearer JWT via Supabase Auth. Returns null
 * when the token is missing or invalid so the handler can reject with 401.
 */
async function getAuthedUserId(req: Request): Promise<string | null> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const jwt = authHeader.slice('Bearer '.length);

  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${jwt}` },
  });
  if (!res.ok) return null;
  const user = (await res.json()) as { id?: string };
  return user.id ?? null;
}

/** Read the user's stored Dodo customer id with the service role (bypasses RLS). */
async function getCustomerId(userId: string): Promise<string | null> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=dodo_customer_id`,
    { headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}` } },
  );
  if (!res.ok) throw new Error(`Profile lookup failed: ${res.status} ${await res.text()}`);
  const rows = (await res.json()) as Array<{ dodo_customer_id: string | null }>;
  return rows[0]?.dodo_customer_id ?? null;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const userId = await getAuthedUserId(req);
    if (!userId) return json({ error: 'Unauthorized' }, 401);

    if (isRateLimited(userId)) {
      return json({ error: 'Too many requests. Please try again in a moment.' }, 429);
    }

    const customerId = await getCustomerId(userId);
    // No Dodo customer means the user has never completed checkout — there is
    // nothing to manage yet.
    if (!customerId) return json({ error: 'No billing account yet.' }, 400);

    const returnUrl = encodeURIComponent(`${APP_URL}/billing`);
    const res = await fetch(
      `${DODO_BASE}/customers/${customerId}/customer-portal/session?return_url=${returnUrl}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${DODO_API_KEY}`,
          'Content-Type': 'application/json',
        },
      },
    );
    if (!res.ok) {
      throw new Error(`Dodo portal session failed: ${res.status} ${await res.text()}`);
    }
    const data = (await res.json()) as { link?: string };
    if (!data.link) throw new Error('Dodo did not return a portal link.');

    return json({ url: data.link });
  } catch (err) {
    console.error(err);
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
