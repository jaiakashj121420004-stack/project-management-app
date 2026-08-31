// Aurora — Dodo Payments checkout session creator (billing).
//
// Authenticated endpoint. The signed-in user calls this to upgrade to Pro; we
// create a Dodo Checkout Session for the chosen interval (monthly / annual) and
// hand back the hosted checkout URL the browser should redirect to. The actual
// plan flip happens later, in the dodo-webhook function, once Dodo confirms the
// subscription is active — never trust the client redirect alone.
//
// Dodo Payments is a Merchant of Record: it collects payment, localizes the
// currency, and handles sales tax / VAT at checkout, so we pass no tax or
// billing address here.
//
// This file runs on Deno (Supabase Edge Runtime), NOT in the Vite app bundle —
// it is excluded from the app's TypeScript/ESLint config on purpose.
//
// Required secrets (set with `supabase secrets set`, never committed):
//   DODO_PAYMENTS_API_KEY     — Dodo secret API key (sent as a Bearer token)
//   DODO_PRODUCT_PRO_MONTHLY  — Dodo product id for the MONTHLY Pro plan (pdt_…)
//   DODO_PRODUCT_PRO_ANNUAL   — Dodo product id for the YEARLY Pro plan (pdt_…);
//                               falls back to the monthly product if unset
//   DODO_PRODUCT_TEAM_MONTHLY — Dodo product id for the MONTHLY Team plan (pdt_…)
//   DODO_PRODUCT_TEAM_ANNUAL  — Dodo product id for the YEARLY Team plan (pdt_…);
//                               falls back to the monthly product if unset
//   APP_URL                   — site origin used for the post-checkout redirect
//   DODO_PAYMENTS_ENVIRONMENT — 'test' (default) or 'live'; selects the API base
// Provided automatically by the Edge runtime: SUPABASE_URL,
// SUPABASE_SERVICE_ROLE_KEY.

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const DODO_API_KEY = Deno.env.get('DODO_PAYMENTS_API_KEY')!;
const PRO_MONTHLY = Deno.env.get('DODO_PRODUCT_PRO_MONTHLY')!;
const PRO_ANNUAL = Deno.env.get('DODO_PRODUCT_PRO_ANNUAL') ?? PRO_MONTHLY;
const TEAM_MONTHLY = Deno.env.get('DODO_PRODUCT_TEAM_MONTHLY') ?? '';
const TEAM_ANNUAL = Deno.env.get('DODO_PRODUCT_TEAM_ANNUAL') ?? TEAM_MONTHLY;
const APP_URL = Deno.env.get('APP_URL')!;

// Client-generated analytics anonymous id (src/lib/analytics.ts) — a random
// UUID, never anything PII-derived. Validated below before it's allowed
// anywhere near Dodo metadata.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Product ids differ between test and live, so the API host must match the key.
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

// Per-user rate limiting. Checkout creation is a rare, deliberate action, so a
// tight window is plenty to blunt accidental floods or a stolen token spamming
// Dodo. Backed by a SHARED Postgres sliding-window counter (rate_limit_hit) so the
// limit holds across isolates/cold starts, not just within one warm isolate. It
// fails OPEN only if the counter query itself errors, so a DB hiccup never blocks a
// legitimate upgrade.
const RATE_LIMIT_MAX = 8;
const RATE_LIMIT_WINDOW_SECONDS = 60;

/** True when the user is over the limit; records this hit otherwise (shared store). */
async function isRateLimited(userId: string): Promise<boolean> {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/rate_limit_hit`, {
      method: 'POST',
      headers: {
        apikey: SERVICE_ROLE,
        Authorization: `Bearer ${SERVICE_ROLE}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        p_key: `checkout:${userId}`,
        p_max: RATE_LIMIT_MAX,
        p_window_seconds: RATE_LIMIT_WINDOW_SECONDS,
      }),
    });
    if (!res.ok) {
      console.error(`rate_limit_hit failed: ${res.status} ${await res.text()}`);
      return true; // fail closed — deny checkout when the limiter is unavailable
    }
    return (await res.json()) === true;
  } catch (err) {
    console.error('rate_limit_hit error', err);
    return true; // fail closed — deny checkout when the limiter is unavailable
  }
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

interface ProfileRow {
  dodo_customer_id: string | null;
  display_name: string | null;
}

/** Read a single profile row with the service role (bypasses RLS). */
async function getProfile(userId: string): Promise<ProfileRow | null> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=dodo_customer_id,display_name`,
    { headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}` } },
  );
  if (!res.ok) throw new Error(`Profile lookup failed: ${res.status} ${await res.text()}`);
  const rows = (await res.json()) as ProfileRow[];
  return rows[0] ?? null;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const user = await getAuthedUser(req);
    if (!user) return json({ error: 'Unauthorized' }, 401);

    if (await isRateLimited(user.id)) {
      return json({ error: 'Too many requests. Please try again in a moment.' }, 429);
    }

    // Reuse the saved Dodo customer if we have one, so a user never ends up with
    // duplicate customers across repeated upgrade attempts; otherwise let Dodo
    // create one keyed to this email.
    const profile = await getProfile(user.id);
    const customer = profile?.dodo_customer_id
      ? { customer_id: profile.dodo_customer_id }
      : {
          email: user.email ?? undefined,
          ...(profile?.display_name ? { name: profile.display_name } : {}),
        };

    // Which plan + billing interval the user picked (defaults to Pro / monthly).
    // Each annual product falls back to its monthly sibling if the ANNUAL secret
    // is unset — a deliberate ergonomic default (see the secrets comment above).
    let interval: 'month' | 'year' = 'month';
    let plan: 'pro' | 'team' = 'pro';
    // Analytics-only: ties the eventual checkout_completed event (recorded by
    // dodo-webhook, the only place that KNOWS payment succeeded) back to this
    // browser's funnel thread. Purely additive — checkout still works exactly
    // the same if this is absent or malformed, it's just not attributable.
    let anonymousId: string | undefined;
    try {
      const body = (await req.json()) as
        | { interval?: string; plan?: string; anonymous_id?: string }
        | null;
      if (body?.interval === 'year') interval = 'year';
      if (body?.plan === 'team') plan = 'team';
      if (typeof body?.anonymous_id === 'string' && UUID_RE.test(body.anonymous_id)) {
        anonymousId = body.anonymous_id;
      }
    } catch {
      // No or invalid JSON body → keep the Pro / monthly defaults.
    }

    if (plan === 'team' && !TEAM_MONTHLY) {
      // Team products haven't been created in Dodo yet for this environment —
      // fail with a clear, specific message rather than silently charging the
      // Pro price for a Team purchase.
      return json({ error: 'The Team plan is not available yet. Please try again shortly.' }, 400);
    }
    const productId = plan === 'team'
      ? (interval === 'year' ? TEAM_ANNUAL : TEAM_MONTHLY)
      : (interval === 'year' ? PRO_ANNUAL : PRO_MONTHLY);

    const res = await fetch(`${DODO_BASE}/checkouts`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${DODO_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        product_cart: [{ product_id: productId, quantity: 1 }],
        customer,
        // metadata lets the webhook map the resulting subscription back to this
        // Supabase user without trusting any client-supplied id. anonymous_id is
        // analytics-only (see above) — the webhook never uses it for billing logic.
        metadata: { user_id: user.id, ...(anonymousId ? { anonymous_id: anonymousId } : {}) },
        return_url: `${APP_URL}/billing?status=success`,
        cancel_url: `${APP_URL}/billing?status=cancelled`,
      }),
    });
    if (!res.ok) {
      throw new Error(`Dodo checkout failed: ${res.status} ${await res.text()}`);
    }
    const data = (await res.json()) as { checkout_url?: string };
    if (!data.checkout_url) throw new Error('Dodo did not return a checkout_url.');

    return json({ url: data.checkout_url });
  } catch (err) {
    // Log the real error server-side, but never leak internal topology / upstream
    // status codes to the browser (M3) — return a generic message.
    console.error(err);
    return json({ error: 'Something went wrong. Please try again.' }, 500);
  }
});
