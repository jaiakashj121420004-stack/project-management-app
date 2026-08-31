// Aurora — MCP (Model Context Protocol) access token issuer (Pro).
//
// Authenticated endpoint. A Pro/Team/Enterprise user calls this from Settings
// to generate, rotate, or revoke the personal access token that authenticates
// Claude Desktop/Code (via the public `mcp-server` function) to their Aurora
// account. Design record: SETUP-MCP.md. Deployment: supabase/README.md.
//
// Unlike calendar-feed-token (a low-stakes, read-only, PLAINTEXT token), this
// token grants read/write access to the caller's whole account, so ONLY A
// SHA-256 HASH IS EVER STORED — this is the ONLY place the plaintext token is
// ever generated or shown, and it is shown exactly once (on generate/rotate).
// It can never be retrieved again, only rotated (invalidates the old one) or
// revoked. This is the ONLY place `profiles.mcp_token_*` is written; the DB
// trigger `protect_mcp_token_columns` (see 20260816120000_mcp_tokens.sql)
// rejects any other writer.
//
//   GET    → { exists, createdAt, lastUsedAt } — NEVER the plaintext.
//   POST   → generates a token if none exists, or rotates to a fresh one when
//            the body is `{ "rotate": true }`. Returns the NEW PLAINTEXT token
//            (only time it's ever returned). Invalidates any previous token.
//   DELETE → revokes the token (clears the hash).
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

// No configured origin means no browser cross-origin access. Never fall back
// to '*' for an authenticated token-management endpoint.
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
        p_key: `mcp-token:${userId}`,
        p_max: RATE_LIMIT_MAX,
        p_window_seconds: RATE_LIMIT_WINDOW_SECONDS,
      }),
    });
    if (!res.ok) {
      console.error(`rate_limit_hit failed: ${res.status} ${await res.text()}`);
      return true; // fail closed
    }
    return (await res.json()) === true;
  } catch (err) {
    console.error('rate_limit_hit error', err);
    return false; // fail open
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
  mcp_token_hash: string | null;
  mcp_token_created_at: string | null;
  mcp_token_last_used_at: string | null;
}

async function getProfile(userId: string): Promise<ProfileRow | null> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=plan,mcp_token_hash,mcp_token_created_at,mcp_token_last_used_at`,
    { headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}` } },
  );
  if (!res.ok) throw new Error(`Profile lookup failed: ${res.status} ${await res.text()}`);
  const rows = (await res.json()) as ProfileRow[];
  return rows[0] ?? null;
}

async function writeToken(userId: string, hash: string | null, createdAt: string | null): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`, {
    method: 'PATCH',
    headers: {
      apikey: SERVICE_ROLE,
      Authorization: `Bearer ${SERVICE_ROLE}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({
      mcp_token_hash: hash,
      mcp_token_created_at: createdAt,
      // A revoke/rotate clears the "last used" marker too — it's meaningless
      // once the token it was measuring no longer exists.
      mcp_token_last_used_at: null,
    }),
  });
  if (!res.ok) throw new Error(`Token update failed: ${res.status} ${await res.text()}`);
}

// 'enterprise' passes too — mirrors isProOrAbove() in src/lib/plans.ts.
function isProOrAbove(plan: string | null): boolean {
  return plan === 'pro' || plan === 'team' || plan === 'enterprise';
}

const TOKEN_PREFIX = 'aurora_mcp_';

/** A high-entropy, recognizable-prefix token (like `ghp_`/`sk_`) — 32 random
 *  bytes, base64url so it's safe to paste into a header or URL unescaped. */
function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const b64url = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${TOKEN_PREFIX}${b64url}`;
}

async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
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
      return json({
        exists: profile.mcp_token_hash !== null,
        createdAt: profile.mcp_token_created_at,
        lastUsedAt: profile.mcp_token_last_used_at,
      });
    }

    if (!isProOrAbove(profile.plan)) {
      return json({ error: 'Connecting Claude to your account is a Pro feature.' }, 403);
    }

    if (await isRateLimited(userId)) {
      return json({ error: 'Too many requests. Please try again in a moment.' }, 429);
    }

    if (req.method === 'DELETE') {
      await writeToken(userId, null, null);
      return json({ exists: false, createdAt: null, lastUsedAt: null });
    }

    if (req.method === 'POST') {
      let rotate = false;
      try {
        const body = (await req.json()) as { rotate?: boolean } | null;
        rotate = body?.rotate === true;
      } catch {
        // No/invalid JSON body → default to "only generate if missing".
      }
      if (profile.mcp_token_hash && !rotate) {
        return json({ error: 'A token already exists. Pass { "rotate": true } to replace it.' }, 409);
      }
      const token = generateToken();
      const hash = await hashToken(token);
      const createdAt = new Date().toISOString();
      await writeToken(userId, hash, createdAt);
      // The ONLY response, ever, that carries the plaintext token.
      return json({ token, createdAt });
    }

    return json({ error: 'Method not allowed' }, 405);
  } catch (err) {
    console.error(err);
    return json({ error: 'Something went wrong. Please try again.' }, 500);
  }
});
