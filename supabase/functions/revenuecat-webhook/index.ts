// Jotspring — RevenueCat webhook receiver (Apple App Store + Google Play billing).
//
// RevenueCat calls this on every subscription event from the native apps. It
// mirrors dodo-webhook: it is the ONLY path by which an in-app purchase can
// change a user's plan. The client never writes the plan. Deployed with
// `--no-verify-jwt` (RevenueCat can't send a Supabase JWT); authenticity is the
// shared secret RevenueCat sends in the Authorization header.
//
// Runs on Deno (Supabase Edge Runtime), NOT in the Vite bundle.
//
// Required secrets (`supabase secrets set`, never committed):
//   REVENUECAT_WEBHOOK_SECRET — the exact string you typed as the
//                               "Authorization header value" in RevenueCat
//   STORE_PRODUCTS_PRO        — comma-separated store product ids that grant Pro
//   STORE_PRODUCTS_TEAM       — comma-separated store product ids that grant Team
// Provided by the runtime: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const WEBHOOK_SECRET = Deno.env.get('REVENUECAT_WEBHOOK_SECRET') ?? '';

const PRODUCT_PLAN: Record<string, 'pro' | 'team'> = {};
for (const id of (Deno.env.get('STORE_PRODUCTS_PRO') ?? '').split(',')) {
  if (id.trim()) PRODUCT_PLAN[id.trim()] = 'pro';
}
for (const id of (Deno.env.get('STORE_PRODUCTS_TEAM') ?? '').split(',')) {
  if (id.trim()) PRODUCT_PLAN[id.trim()] = 'team';
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface RcEvent {
  type?: string;
  app_user_id?: string;
  product_id?: string;
  store?: string;
  expiration_at_ms?: number | null;
  original_transaction_id?: string;
  transaction_id?: string;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

async function rest(path: string, init: RequestInit): Promise<Response> {
  return await fetch(`${SUPABASE_URL}${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_ROLE,
      authorization: `Bearer ${SERVICE_ROLE}`,
      'content-type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'method not allowed' });
  if (!WEBHOOK_SECRET) return json(500, { error: 'webhook not configured' });

  const auth = req.headers.get('authorization') ?? '';
  if (!timingSafeEqual(auth, WEBHOOK_SECRET) && !timingSafeEqual(auth, `Bearer ${WEBHOOK_SECRET}`)) {
    return json(401, { error: 'unauthorized' });
  }

  let event: RcEvent;
  try {
    event = ((await req.json()) as { event?: RcEvent }).event ?? {};
  } catch {
    return json(400, { error: 'bad json' });
  }

  const type = event.type ?? '';
  // TEST pings and TRANSFER events need no database change.
  if (type === 'TEST' || type === 'TRANSFER') return json(200, { ok: true, ignored: type });

  const userId = event.app_user_id ?? '';
  if (!UUID_RE.test(userId)) return json(200, { ok: true, ignored: 'non-user app_user_id' });

  const plan = PRODUCT_PLAN[event.product_id ?? ''];
  if (!plan) {
    console.error('revenuecat-webhook: unknown product', event.product_id);
    return json(200, { ok: true, ignored: 'unknown product' });
  }

  const source = event.store === 'PLAY_STORE' ? 'play_store' : event.store === 'APP_STORE' ? 'app_store' : null;
  if (!source) return json(200, { ok: true, ignored: `store ${event.store}` });

  const expiresAt = event.expiration_at_ms ? new Date(event.expiration_at_ms) : null;
  const lapsed = type === 'EXPIRATION' || (expiresAt !== null && expiresAt.getTime() <= Date.now());
  const status = lapsed ? 'expired' : type === 'BILLING_ISSUE' ? 'billing_issue' : 'active';

  const up = await rest('/rest/v1/entitlements?on_conflict=user_id,source', {
    method: 'POST',
    headers: { prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({
      user_id: userId,
      source,
      plan,
      status,
      product_id: event.product_id,
      external_id: event.original_transaction_id ?? event.transaction_id ?? null,
      expires_at: expiresAt?.toISOString() ?? null,
      updated_at: new Date().toISOString(),
    }),
  });
  if (!up.ok) {
    console.error('revenuecat-webhook: upsert failed', up.status, await up.text());
    return json(500, { error: 'entitlement write failed' });
  }

  const rc = await rest('/rest/v1/rpc/recompute_profile_plan', {
    method: 'POST',
    body: JSON.stringify({ p_user: userId }),
  });
  if (!rc.ok) {
    console.error('revenuecat-webhook: recompute failed', rc.status, await rc.text());
    return json(500, { error: 'plan recompute failed' });
  }

  return json(200, { ok: true, type, status });
});
