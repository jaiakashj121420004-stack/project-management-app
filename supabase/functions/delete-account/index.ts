// Jotspring — in-app account deletion (required by Apple App Store and Google Play).
//
// Authenticated endpoint. Permanently deletes the caller's account. Nearly all
// user data hangs off auth.users with ON DELETE CASCADE (profiles, owned
// projects, cards, notes, todos, canvases, folders…), and links to other
// people's content use ON DELETE SET NULL, so removing the auth user removes
// everything the user owns. Shared boards they only belong to stay intact for
// the other members.
//
// Before deleting, any active Dodo subscription is cancelled (best effort) so a
// deleted user is never billed again. Store subscriptions (Google Play / Apple)
// can only be cancelled by the user in the store — the app tells them so.
//
// Runs on Deno (Supabase Edge Runtime), not in the Vite bundle.
//
// Secrets: DODO_PAYMENTS_API_KEY, DODO_PAYMENTS_ENVIRONMENT ('test'|'live'),
// APP_URL. SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are provided automatically.

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const DODO_API_KEY = Deno.env.get('DODO_PAYMENTS_API_KEY') ?? '';
const APP_URL = Deno.env.get('APP_URL')!;

const DODO_BASE = (Deno.env.get('DODO_PAYMENTS_ENVIRONMENT') ?? 'test').toLowerCase().startsWith('live')
  ? 'https://live.dodopayments.com'
  : 'https://test.dodopayments.com';

// Browser calls come from the web app; native apps (Capacitor) call from
// https://localhost or capacitor://localhost, so those origins are allowed too.
const ALLOWED_ORIGINS = new Set([APP_URL, 'https://localhost', 'capacitor://localhost', 'http://localhost']);

function corsFor(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? '';
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.has(origin) ? origin : APP_URL,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}

function json(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsFor(req), 'Content-Type': 'application/json' },
  });
}

async function getAuthedUserId(req: Request): Promise<string | null> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SERVICE_ROLE, Authorization: authHeader },
  });
  if (!res.ok) return null;
  const user = (await res.json()) as { id?: string };
  return user.id ?? null;
}

async function getDodoSubscriptionId(userId: string): Promise<string | null> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=dodo_subscription_id`, {
    headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}` },
  });
  if (!res.ok) return null;
  const rows = (await res.json()) as Array<{ dodo_subscription_id: string | null }>;
  return rows[0]?.dodo_subscription_id ?? null;
}

/** Best effort: stop future Dodo billing. Never blocks the deletion. */
async function cancelDodoSubscription(subscriptionId: string): Promise<void> {
  if (!DODO_API_KEY) return;
  try {
    const res = await fetch(`${DODO_BASE}/subscriptions/${subscriptionId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${DODO_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ cancel_at_next_billing_date: true }),
    });
    if (!res.ok) console.error(`Dodo cancel failed: ${res.status} ${await res.text()}`);
  } catch (err) {
    console.error('Dodo cancel error', err);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsFor(req) });
  if (req.method !== 'POST') return json(req, { error: 'Method not allowed' }, 405);

  try {
    const userId = await getAuthedUserId(req);
    if (!userId) return json(req, { error: 'Unauthorized' }, 401);

    const body = (await req.json().catch(() => ({}))) as { confirm?: string };
    if (body.confirm !== 'DELETE') return json(req, { error: 'Confirmation text is required.' }, 400);

    const subId = await getDodoSubscriptionId(userId);
    if (subId) await cancelDodoSubscription(subId);

    const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
      method: 'DELETE',
      headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}` },
    });
    if (!res.ok) throw new Error(`Admin delete failed: ${res.status} ${await res.text()}`);

    return json(req, { ok: true });
  } catch (err) {
    console.error(err);
    return json(req, { error: 'Something went wrong. Please try again.' }, 500);
  }
});
