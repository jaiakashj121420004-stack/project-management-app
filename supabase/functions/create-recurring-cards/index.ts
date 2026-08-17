// Aurora — recurring Kanban card creation (feature request session, 2026-08-17).
//
// A separate Edge Function from send-due-reminders on purpose: this has a
// different trigger cadence (daily, not every 10 minutes — a card's recurrence
// is date-grained, not time-grained), no email provider dependency, and a
// distinct failure mode (a stuck run here should never block reminder
// delivery, and vice versa). Deployed and secured exactly like
// send-due-reminders (no-JWT-verification function, called only by pg_cron via
// pg_net with a shared x-cron-secret header) — see supabase/README.md for that
// function's setup; the steps here are the same, just a new function name and
// a daily schedule instead of */10 * * * *.
//
// All the actual logic — which cards are due, creating the next instance with
// a fresh checklist and no carried-over comments/attachments/time entries —
// lives in the SECURITY DEFINER `run_due_card_recurrences()` SQL function
// (supabase/migrations/20260817130000_card_recurrence.sql). This function is
// a thin, auth-checked trigger for that RPC, same shape as send-due-reminders'
// calls to due_reminder_candidates/mark_reminders_sent.
//
// Required secret (set with `supabase secrets set`, never committed):
//   CRON_SECRET — shared secret the cron job sends in the x-cron-secret header
//                 so only the scheduler can invoke this function. Reuse the
//                 SAME value already set for send-due-reminders — it's just a
//                 shared secret, not tied to one function.
// Provided automatically by the Edge runtime: SUPABASE_URL,
// SUPABASE_SERVICE_ROLE_KEY.

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? '';

/**
 * Constant-time string comparison so the shared-secret check can't be defeated
 * by measuring how long a mismatch takes to reject. Same implementation as
 * send-due-reminders — kept duplicated rather than shared, since Edge
 * Functions each deploy as an isolated bundle in this project (no shared
 * `_shared/` module exists yet; introducing one is a bigger refactor than this
 * task's scope).
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Constant-time secret check over fixed-length digests, so neither a mismatch
 *  nor a length difference is timing-observable. */
async function secretMatches(provided: string, secret: string): Promise<boolean> {
  if (!secret) return false;
  return timingSafeEqual(await sha256Hex(provided), await sha256Hex(secret));
}

/** Call a SECURITY DEFINER RPC with the service role. */
async function rpc<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_ROLE,
      Authorization: `Bearer ${SERVICE_ROLE}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`RPC ${name} failed: ${res.status} ${await res.text()}`);
  const text = await res.text();
  return (text ? (JSON.parse(text) as T) : (null as T));
}

Deno.serve(async (req: Request) => {
  // Only the scheduler (which knows CRON_SECRET) may invoke this — same
  // constant-time-over-fixed-length-digests check as send-due-reminders.
  if (!(await secretMatches(req.headers.get('x-cron-secret') ?? '', CRON_SECRET))) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const created = await rpc<number>('run_due_card_recurrences', {});
    return Response.json({ ok: true, created });
  } catch (err) {
    console.error(err);
    return new Response(`Error: ${err instanceof Error ? err.message : String(err)}`, {
      status: 500,
    });
  }
});
