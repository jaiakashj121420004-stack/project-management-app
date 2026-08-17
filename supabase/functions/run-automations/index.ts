// Aurora — rule-builder automations: the due_date_passed cron trigger.
//
// card_moved_to_column and checklist_completed are real Postgres AFTER-UPDATE
// triggers (run_automations_for_card_move / run_automations_for_checklist,
// 20260817140000_automation_rules.sql) — they fire inline, server-side, with
// no client needing to stay connected. due_date_passed has no row write to
// hook a trigger onto (nothing changes "when a date passes"), so it needs the
// same periodic-scan shape as due-date reminders and card recurrence: a
// service-role-only SQL function (run_due_date_automations()) invoked on a
// schedule. Deployed and secured exactly like create-recurring-cards (no-JWT-
// verification function, called only by pg_cron via pg_net with a shared
// x-cron-secret header) — see supabase/README.md.
//
// A separate function from create-recurring-cards on purpose, same reasoning
// as that function's own separation from send-due-reminders: distinct failure
// domain (a stuck automations run should never block recurring-card creation
// or reminder delivery, and vice versa).
//
// Required secret (set with `supabase secrets set`, never committed):
//   CRON_SECRET — shared secret the cron job sends in the x-cron-secret header.
//                 Reuse the SAME value already set for the other cron
//                 functions — it's just a shared secret, not tied to one.
// Provided automatically by the Edge runtime: SUPABASE_URL,
// SUPABASE_SERVICE_ROLE_KEY.

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? '';

/** Constant-time comparison so a mismatch's timing can't leak the secret — same
 *  implementation as send-due-reminders/create-recurring-cards (kept
 *  duplicated: each Edge Function deploys as an isolated bundle in this
 *  project, no shared `_shared/` module exists yet). */
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
  if (!(await secretMatches(req.headers.get('x-cron-secret') ?? '', CRON_SECRET))) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const fired = await rpc<number>('run_due_date_automations', {});
    return Response.json({ ok: true, fired });
  } catch (err) {
    console.error(err);
    return new Response(`Error: ${err instanceof Error ? err.message : String(err)}`, {
      status: 500,
    });
  }
});
