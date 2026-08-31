// Aurora — Calendar subscribe feed token issuer (Pro).
//
// Authenticated endpoint. A Pro/Team/Enterprise user calls this from Settings
// to get (or rotate) the opaque token that identifies them to the PUBLIC
// `calendar-feed` function — the one an external calendar app (Google
// Calendar, Apple Calendar, Outlook) polls on a plain URL with no Supabase
// session. This is the ONLY place `profiles.calendar_feed_token` is written;
// the DB trigger `protect_calendar_feed_token` (see
// 20260813020000_calendar_feed_token.sql) rejects any other writer.
//
//   GET    → returns the caller's current token (or null if never generated).
//   POST   → generates a token if none exists, or rotates to a fresh one when
//            the body is `{ "rotate": true }`. Invalidates any previously
//            shared subscribe URL on rotate.
//   DELETE → revokes the feed (sets the token back to null).
//
// This file runs on Deno (Supabase Edge Runtime), NOT in the Vite app bundle —
// it is excluded from the app's TypeScript/ESLint config on purpose.
//
// Required env: APP_URL (CORS allow-list origin).
// Provided automatically by the Edge runtime: SUPABASE_URL,
// SUPABASE_SERVICE_ROLE_KEY.

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const APP_URL = Deno.env.get('APP_URL');

// Missing APP_URL disables browser cross-origin access; never broaden it to '*'.
const corsHeaders: Record<string, string> = {
  ...(APP_URL ? { 'Access-Control-Allow-Origin': APP_URL } : {}),
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  Vary: 'Origin',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Same shared sliding-window limiter as the other self-serve billing/account
// functions — token rotation is a rare, deliberate action.
const RATE_LIMIT_MAX = 10;
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
        p_key: `calendar-feed-token:${userId}`,
        p_max: RATE_LIMIT_MAX,
        p_window_seconds: RATE_LIMIT_WINDOW_SECONDS,
      }),
    });
    if (!res.ok) {
      console.error(`rate_limit_hit failed: ${res.status} ${await res.text()}`);
      return true; // fail closed — deny token operations when the limiter is unavailable
    }
    return (await res.json()) === true;
  } catch (err) {
    console.error('rate_limit_hit error', err);
    return true; // fail closed — deny token operations when the limiter is unavailable
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
  calendar_feed_token: string | null;
}

async function getProfile(userId: string): Promise<ProfileRow | null> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=plan,calendar_feed_token`,
    { headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}` } },
  );
  if (!res.ok) throw new Error(`Profile lookup failed: ${res.status} ${await res.text()}`);
  const rows = (await res.json()) as ProfileRow[];
  return rows[0] ?? null;
}

async function setToken(userId: string, token: string | null): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`, {
    method: 'PATCH',
    headers: {
      apikey: SERVICE_ROLE,
      Authorization: `Bearer ${SERVICE_ROLE}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ calendar_feed_token: token }),
  });
  if (!res.ok) throw new Error(`Token update failed: ${res.status} ${await res.text()}`);
}

// 'enterprise' passes too — mirrors isProOrAbove() in src/lib/plans.ts.
function isProOrAbove(plan: string | null): boolean {
  return plan === 'pro' || plan === 'team' || plan === 'enterprise';
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const userId = await getAuthedUserId(req);
    if (!userId) return json({ error: 'Unauthorized' }, 401);

    const profile = await getProfile(userId);
    if (!profile) return json({ error: 'Profile not found' }, 404);

    if (req.method === 'GET') {
      return json({ token: profile.calendar_feed_token });
    }

    if (!isProOrAbove(profile.plan)) {
      return json({ error: 'The calendar subscribe feed is a Pro feature.' }, 403);
    }

    if (await isRateLimited(userId)) {
      return json({ error: 'Too many requests. Please try again in a moment.' }, 429);
    }

    if (req.method === 'DELETE') {
      await setToken(userId, null);
      return json({ token: null });
    }

    if (req.method === 'POST') {
      let rotate = false;
      try {
        const body = (await req.json()) as { rotate?: boolean } | null;
        rotate = body?.rotate === true;
      } catch {
        // No/invalid JSON body → default to "only generate if missing".
      }
      if (profile.calendar_feed_token && !rotate) {
        return json({ token: profile.calendar_feed_token });
      }
      const token = crypto.randomUUID();
      await setToken(userId, token);
      return json({ token });
    }

    return json({ error: 'Method not allowed' }, 405);
  } catch (err) {
    console.error(err);
    return json({ error: 'Something went wrong. Please try again.' }, 500);
  }
});
