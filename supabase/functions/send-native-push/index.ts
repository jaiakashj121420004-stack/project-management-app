// Jotspring — native push sender (iOS + Android via Firebase Cloud Messaging).
//
// FCM HTTP v1 delivers to Android directly and to iOS through the APNs key you
// upload in the Firebase console, so ONE sender covers both stores.
// Invoked server-to-server only (the reminders function / cron), authenticated
// with the same shared secret as send-due-reminders.
//
// POST { user_id: uuid, title: string, body: string, url?: string }
//
// Runs on Deno (Supabase Edge Runtime), NOT in the Vite bundle.
//
// Required secrets (`supabase secrets set`, never committed):
//   FCM_SERVICE_ACCOUNT — the Firebase service-account JSON, as one string
//   CRON_SECRET         — shared secret expected in the x-cron-secret header
// Provided by the runtime: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? '';
const SA_RAW = Deno.env.get('FCM_SERVICE_ACCOUNT') ?? '';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface ServiceAccount {
  project_id: string;
  client_email: string;
  private_key: string;
}

function b64url(input: ArrayBuffer | string): string {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : new Uint8Array(input);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function pemToDer(pem: string): ArrayBuffer {
  const body = pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const bin = atob(body);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

async function accessToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    }),
  );
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToDer(sa.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(`${header}.${claims}`));
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${header}.${claims}.${b64url(sig)}`,
    }),
  });
  if (!res.ok) throw new Error(`token exchange failed: ${res.status}`);
  return ((await res.json()) as { access_token: string }).access_token;
}

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'method not allowed' });
  if (!CRON_SECRET || !timingSafeEqual(req.headers.get('x-cron-secret') ?? '', CRON_SECRET)) {
    return json(401, { error: 'unauthorized' });
  }
  if (!SA_RAW) return json(200, { ok: true, skipped: 'FCM not configured' });

  let payload: { user_id?: string; title?: string; body?: string; url?: string };
  try {
    payload = await req.json();
  } catch {
    return json(400, { error: 'bad json' });
  }
  if (!payload.user_id || !UUID_RE.test(payload.user_id) || !payload.title || !payload.body) {
    return json(400, { error: 'user_id, title and body are required' });
  }

  const db = { apikey: SERVICE_ROLE, authorization: `Bearer ${SERVICE_ROLE}` };
  const tokensRes = await fetch(
    `${SUPABASE_URL}/rest/v1/push_tokens?user_id=eq.${payload.user_id}&select=id,token`,
    { headers: db },
  );
  if (!tokensRes.ok) return json(500, { error: 'token lookup failed' });
  const tokens = (await tokensRes.json()) as { id: string; token: string }[];
  if (tokens.length === 0) return json(200, { ok: true, sent: 0 });

  const sa = JSON.parse(SA_RAW) as ServiceAccount;
  const bearer = await accessToken(sa);
  let sent = 0;
  const dead: string[] = [];

  for (const t of tokens) {
    const res = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
      method: 'POST',
      headers: { authorization: `Bearer ${bearer}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        message: {
          token: t.token,
          notification: { title: payload.title, body: payload.body },
          data: payload.url ? { url: payload.url } : undefined,
        },
      }),
    });
    if (res.ok) sent++;
    else if (res.status === 404) dead.push(t.id);
    else console.error('send-native-push: fcm error', res.status);
  }

  // Drop tokens FCM says no longer exist (app uninstalled / token rotated).
  if (dead.length > 0) {
    await fetch(`${SUPABASE_URL}/rest/v1/push_tokens?id=in.(${dead.join(',')})`, { method: 'DELETE', headers: db });
  }
  return json(200, { ok: true, sent, removed: dead.length });
});
