// Aurora — minimal funnel-analytics event recorder.
//
// The ONLY way a client (signed in OR signed out) may write a row into
// `analytics_events` — the table itself denies anon/authenticated reads and
// writes outright (RLS, see supabase/migrations/20260815120000_analytics_events.sql).
// This function validates the request, stamps `user_id` server-side from the
// caller's session (never trusted from the body), and inserts with the service
// role. Same defense-in-depth stance as the rest of this repo's Edge Functions
// (e.g. dodo-webhook is the only writer of profiles.plan) — the client never
// gets to write analytics data directly, only through this gate.
//
// Deployed WITHOUT --no-verify-jwt (the default): a signed-out caller still
// sends a valid JWT because supabase-js falls back to the project's anon key,
// which is itself a legitimately-signed token — so this function works for
// both authenticated and anonymous callers without disabling JWT verification.
//
// Required secrets: none beyond the ones the Edge Runtime provides automatically
// (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY).

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const APP_URL = Deno.env.get('APP_URL') ?? '*';

// Browsers call this cross-origin from the app only. Falls back to '*' only if
// APP_URL isn't configured, so analytics never blocks the app in a fresh
// environment — the table's RLS + the allow-list below are the real gates, not
// CORS.
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

// The full set of events this endpoint will ever record — a client-supplied
// event_name outside this list is rejected outright. Keep in sync with
// ANALYTICS_EVENTS in src/lib/analytics.ts and reports/ANALYTICS.md. Deliberately
// small and funnel-shaped, not an open taxonomy — this is a minimal
// funnel-tracking layer, not a general analytics platform (memory.md scope note).
const ALLOWED_EVENTS = new Set([
  'landing_page_viewed',
  'signup_started',
  'signup_completed',
  'first_board_created',
  'first_card_created',
  'upgrade_prompt_shown',
  'checkout_started',
  'checkout_completed',
  'install_prompt_shown',
  'install_accepted',
  'install_dismissed',
  'table_inserted',
  'time_entry_started',
  'time_entry_stopped',
]);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Per-caller rate limiting so a runaway client (or abuse) can't flood the
// table. Backed by the SAME shared Postgres sliding-window counter the billing
// functions use (rate_limit_hit, 20260715140000_edge_hardening.sql) so the
// limit holds across isolates/cold starts. Generous — legitimate usage is a
// handful of events per page view — and fails OPEN on a limiter error, so a DB
// hiccup never silently breaks the app either (analytics must never be able to
// break the product it's instrumenting).
const RATE_LIMIT_MAX = 40;
const RATE_LIMIT_WINDOW_SECONDS = 60;

async function isRateLimited(key: string): Promise<boolean> {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/rate_limit_hit`, {
      method: 'POST',
      headers: {
        apikey: SERVICE_ROLE,
        Authorization: `Bearer ${SERVICE_ROLE}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        p_key: `analytics:${key}`,
        p_max: RATE_LIMIT_MAX,
        p_window_seconds: RATE_LIMIT_WINDOW_SECONDS,
      }),
    });
    if (!res.ok) {
      console.error(`rate_limit_hit failed: ${res.status} ${await res.text()}`);
      return false; // fail open
    }
    return (await res.json()) === true;
  } catch (err) {
    console.error('rate_limit_hit error', err);
    return false; // fail open
  }
}

/** Resolve the caller's user id from their bearer JWT, or null when it's the
 *  anon key / missing / invalid — analytics accepts anonymous callers, so this
 *  never rejects the request, it only decides whether user_id is set. */
async function resolveUserId(req: Request): Promise<string | null> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const jwt = authHeader.slice('Bearer '.length);
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${jwt}` },
    });
    if (!res.ok) return null; // anon key or expired/invalid token — stays anonymous
    const user = (await res.json()) as { id?: string };
    return user.id ?? null;
  } catch {
    return null;
  }
}

interface TrackRequestBody {
  event_name?: unknown;
  anonymous_id?: unknown;
  properties?: unknown;
}

// Caps how much a single event can carry — this is a funnel-tracking log, not a
// blob store. Rejecting oversized payloads server-side (not just trusting the
// client to behave) is the same "frontend is untrusted" stance as everywhere
// else in this app (plan.md §6).
const MAX_PROPERTIES_BYTES = 4096;
const MAX_PROPERTY_KEYS = 30;

/** A plain, JSON-safe properties object, or null if the shape is invalid. Only
 *  string/number/boolean/null leaf values are allowed — no nested objects/arrays,
 *  which keeps the allow-listed events genuinely small and structured. */
function sanitizeProperties(value: unknown): Record<string, string | number | boolean | null> | null {
  if (value === undefined || value === null) return {};
  if (typeof value !== 'object' || Array.isArray(value)) return null;
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length > MAX_PROPERTY_KEYS) return null;
  const out: Record<string, string | number | boolean | null> = {};
  for (const [key, val] of entries) {
    if (typeof key !== 'string' || key.length > 100) return null;
    if (val !== null && !['string', 'number', 'boolean'].includes(typeof val)) return null;
    if (typeof val === 'string' && val.length > 500) return null;
    out[key] = val as string | number | boolean | null;
  }
  if (new TextEncoder().encode(JSON.stringify(out)).length > MAX_PROPERTIES_BYTES) return null;
  return out;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  let body: TrackRequestBody;
  try {
    body = (await req.json()) as TrackRequestBody;
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  if (typeof body.event_name !== 'string' || !ALLOWED_EVENTS.has(body.event_name)) {
    // Deliberately vague — don't help a prober enumerate the allow-list.
    return json({ error: 'Unknown event_name' }, 400);
  }
  const eventName = body.event_name;

  const anonymousId =
    typeof body.anonymous_id === 'string' && UUID_RE.test(body.anonymous_id)
      ? body.anonymous_id
      : null;

  const properties = sanitizeProperties(body.properties);
  if (properties === null) {
    return json({ error: 'Invalid properties' }, 400);
  }

  const userId = await resolveUserId(req);

  // Rate-limit key: prefer the signed-in user, then the client's anonymous id,
  // then fall back to the edge network's forwarded IP so a logged-out caller
  // with no anonymous_id can't bypass the limiter entirely.
  const rateLimitKey =
    userId ?? anonymousId ?? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  if (await isRateLimited(rateLimitKey)) {
    return json({ error: 'Too many requests.' }, 429);
  }

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/analytics_events`, {
      method: 'POST',
      headers: {
        apikey: SERVICE_ROLE,
        Authorization: `Bearer ${SERVICE_ROLE}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        user_id: userId,
        anonymous_id: anonymousId,
        event_name: eventName,
        properties,
      }),
    });
    if (!res.ok) {
      throw new Error(`analytics_events insert failed: ${res.status} ${await res.text()}`);
    }
    return json({ ok: true });
  } catch (err) {
    // Log server-side only; never leak internals, and never let a storage hiccup
    // read as anything other than a soft failure to the client (analytics.ts
    // already treats every response as fire-and-forget).
    console.error(err);
    return json({ error: 'Could not record event.' }, 500);
  }
});
