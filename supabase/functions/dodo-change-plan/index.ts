// Aurora — Dodo Payments in-place plan/interval switcher (billing).
//
// Authenticated endpoint. An already-paying user (Pro or Team) calls this to
// switch billing interval (monthly ↔ annual) or move Pro ↔ Team. Unlike
// dodo-create-checkout, this does NOT start a new Checkout Session — it PATCHes
// the customer's EXISTING Dodo subscription via the Change Plan API. That
// matters: if we sent an already-subscribed user back through Checkout, Dodo
// would create a SECOND parallel subscription (the old one keeps renewing too),
// silently double-billing the customer. Change Plan swaps the product on the
// one subscription they already have, with Dodo prorating the difference.
//
// The actual plan flip in our DB still only ever happens in dodo-webhook, via
// the `subscription.plan_changed` event — this function never writes
// `profiles.plan` itself, matching the same "webhook is the only source of
// truth" rule as checkout.
//
// This file runs on Deno (Supabase Edge Runtime), NOT in the Vite app bundle —
// it is excluded from the app's TypeScript/ESLint config on purpose.
//
// Required secrets (set with `supabase secrets set`, never committed):
//   DODO_PAYMENTS_API_KEY     — Dodo secret API key (sent as a Bearer token)
//   DODO_PRODUCT_PRO_MONTHLY  — Dodo product id for the MONTHLY Pro plan (pdt_…)
//   DODO_PRODUCT_PRO_ANNUAL   — Dodo product id for the YEARLY Pro plan (pdt_…)
//   DODO_PRODUCT_TEAM_MONTHLY — Dodo product id for the MONTHLY Team plan (pdt_…)
//   DODO_PRODUCT_TEAM_ANNUAL  — Dodo product id for the YEARLY Team plan (pdt_…)
//   APP_URL                   — site origin, used only for the CORS allow-list
//   DODO_PAYMENTS_ENVIRONMENT — 'test' (default) or 'live'; selects the API base
// Provided automatically by the Edge runtime: SUPABASE_URL,
// SUPABASE_SERVICE_ROLE_KEY.

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const DODO_API_KEY = Deno.env.get('DODO_PAYMENTS_API_KEY')!;
const PRO_MONTHLY = Deno.env.get('DODO_PRODUCT_PRO_MONTHLY') ?? '';
const PRO_ANNUAL = Deno.env.get('DODO_PRODUCT_PRO_ANNUAL') || PRO_MONTHLY;
const TEAM_MONTHLY = Deno.env.get('DODO_PRODUCT_TEAM_MONTHLY') ?? '';
const TEAM_ANNUAL = Deno.env.get('DODO_PRODUCT_TEAM_ANNUAL') || TEAM_MONTHLY;
const APP_URL = Deno.env.get('APP_URL')!;

const DODO_BASE = (Deno.env.get('DODO_PAYMENTS_ENVIRONMENT') ?? 'test')
  .toLowerCase()
  .startsWith('live')
  ? 'https://live.dodopayments.com'
  : 'https://test.dodopayments.com';

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

// Same shared sliding-window limiter as the other billing functions — plan
// changes are rare, deliberate actions, so a tight window is plenty.
const RATE_LIMIT_MAX = 8;
const RATE_LIMIT_WINDOW_SECONDS = 60;

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
        p_key: `change-plan:${userId}`,
        p_max: RATE_LIMIT_MAX,
        p_window_seconds: RATE_LIMIT_WINDOW_SECONDS,
      }),
    });
    if (!res.ok) {
      console.error(`rate_limit_hit failed: ${res.status} ${await res.text()}`);
      return true; // fail closed — deny plan changes when the limiter is unavailable
    }
    return (await res.json()) === true;
  } catch (err) {
    console.error('rate_limit_hit error', err);
    return true; // fail closed — deny plan changes when the limiter is unavailable
  }
}

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

interface ProfileRow {
  plan: string | null;
  dodo_subscription_id: string | null;
}

/** Read the caller's plan + subscription id with the service role (bypasses RLS). */
async function getProfile(userId: string): Promise<ProfileRow | null> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=plan,dodo_subscription_id`,
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
    const userId = await getAuthedUserId(req);
    if (!userId) return json({ error: 'Unauthorized' }, 401);

    if (await isRateLimited(userId)) {
      return json({ error: 'Too many requests. Please try again in a moment.' }, 429);
    }

    const profile = await getProfile(userId);
    if (!profile?.dodo_subscription_id) {
      // No existing subscription to modify — the client should use Checkout
      // instead (first-time purchase, nothing to prorate against).
      return json({ error: 'No active subscription to update.' }, 400);
    }
    // Only Pro/Team may self-serve a plan change; Enterprise and Free never
    // reach this endpoint with a real subscription id.
    if (profile.plan !== 'pro' && profile.plan !== 'team') {
      return json({ error: 'No active subscription to update.' }, 400);
    }

    let interval: 'month' | 'year' = 'month';
    let targetPlan: 'pro' | 'team' = profile.plan;
    try {
      const body = (await req.json()) as { interval?: string; plan?: string } | null;
      if (body?.interval === 'year') interval = 'year';
      if (body?.plan === 'team') targetPlan = 'team';
      else if (body?.plan === 'pro') targetPlan = 'pro';
    } catch {
      // No/invalid JSON body → keep interval=month and the current plan.
    }

    if (targetPlan === 'team' && !TEAM_MONTHLY) {
      return json({ error: 'The Team plan is not available yet. Please try again shortly.' }, 400);
    }
    const productId =
      targetPlan === 'team'
        ? interval === 'year'
          ? TEAM_ANNUAL
          : TEAM_MONTHLY
        : interval === 'year'
          ? PRO_ANNUAL
          : PRO_MONTHLY;
    if (!productId) {
      return json({ error: 'That plan is not available yet. Please try again shortly.' }, 400);
    }

    const res = await fetch(
      `${DODO_BASE}/subscriptions/${encodeURIComponent(profile.dodo_subscription_id)}/change-plan`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${DODO_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          product_id: productId,
          quantity: 1,
          // Charge/credit only the difference right away — the simplest,
          // most predictable mental model for a self-serve switch.
          proration_billing_mode: 'difference_immediately',
        }),
      },
    );

    if (res.status === 409) {
      return json(
        { error: 'A plan change is already in progress. Please wait a moment and try again.' },
        409,
      );
    }
    if (res.status === 422) {
      return json({ error: 'Your subscription can’t be changed right now. Try the billing portal instead.' }, 422);
    }
    if (!res.ok) {
      throw new Error(`Dodo change-plan failed: ${res.status} ${await res.text()}`);
    }

    // Success is 200 with an empty body — the real confirmation arrives via the
    // subscription.plan_changed webhook, which is what actually updates
    // profiles.plan.
    return json({ ok: true });
  } catch (err) {
    console.error(err);
    return json({ error: 'Something went wrong. Please try again.' }, 500);
  }
});
