// Aurora — due-date reminder Edge Function (Phase 9).
//
// Runs on a schedule (pg_cron → pg_net, see supabase/README.md). It asks the DB
// for cards due within each assignee's lead window (via the SECURITY DEFINER
// `due_reminder_candidates` RPC, service-role only), emails each assignee a
// digest through Resend, then marks those cards reminded so they aren't emailed
// again for the same due date.
//
// This file runs on Deno (Supabase Edge Runtime), NOT in the Vite app bundle —
// it is excluded from the app's TypeScript/ESLint config on purpose.
//
// Required secrets (set with `supabase secrets set`, never committed):
//   RESEND_API_KEY      — Resend API key (free tier; https://resend.com)
//   REMINDER_FROM_EMAIL — verified sender, e.g. "Aurora <reminders@yourdomain>"
//                         (defaults to Resend's onboarding@resend.dev for tests)
//   CRON_SECRET         — shared secret the cron job sends in the x-cron-secret
//                         header so only the scheduler can invoke this function
// Provided automatically by the Edge runtime: SUPABASE_URL,
// SUPABASE_SERVICE_ROLE_KEY.

interface Candidate {
  card_id: string;
  title: string;
  due_date: string;
  project_id: string;
  project_name: string;
  assignee_id: string;
  email: string;
  display_name: string | null;
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const FROM_EMAIL = Deno.env.get('REMINDER_FROM_EMAIL') ?? 'Aurora <onboarding@resend.dev>';
const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? '';

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
  return (await res.json()) as T;
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
}

function dueLabel(due: string): string {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const date = new Date(`${due}T00:00:00Z`);
  const days = Math.round((date.getTime() - today.getTime()) / 86_400_000);
  if (days <= 0) return 'due today';
  if (days === 1) return 'due tomorrow';
  return `due in ${days} days`;
}

/** On-brand HTML digest for one assignee's due cards. */
function renderEmail(name: string | null, cards: Candidate[]): string {
  const greeting = name ? escapeHtml(name.split(' ')[0]) : 'there';
  const rows = cards
    .map(
      (c) => `
        <tr>
          <td style="padding:12px 16px;border-bottom:1px solid #eee;">
            <div style="font-weight:600;color:#1a1330;">${escapeHtml(c.title)}</div>
            <div style="font-size:13px;color:#7a7090;">${escapeHtml(c.project_name)} · ${dueLabel(
              c.due_date,
            )} (${escapeHtml(c.due_date)})</div>
          </td>
        </tr>`,
    )
    .join('');

  return `<!doctype html><html><body style="margin:0;background:#faf7ff;font-family:Inter,Segoe UI,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 0;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 12px 40px rgba(80,40,120,.12);">
          <tr><td style="background:linear-gradient(110deg,#7C3AED,#06B6D4);padding:28px 24px;">
            <div style="color:#fff;font-size:22px;font-weight:700;">Aurora</div>
            <div style="color:rgba(255,255,255,.85);font-size:14px;margin-top:4px;">Upcoming due dates</div>
          </td></tr>
          <tr><td style="padding:24px 8px 8px;">
            <p style="margin:0 0 8px 16px;color:#1a1330;font-size:15px;">Hi ${greeting}, you have ${
              cards.length
            } task${cards.length === 1 ? '' : 's'} coming up:</p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>
          </td></tr>
          <tr><td style="padding:16px 24px 28px;">
            <p style="margin:0;color:#9a90a8;font-size:12px;">You're receiving this because email reminders are on in your Aurora profile. Turn them off any time in Profile → Reminders.</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body></html>`;
}

async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
  });
  if (!res.ok) {
    console.error(`Resend failed for ${to}: ${res.status} ${await res.text()}`);
    return false;
  }
  return true;
}

Deno.serve(async (req: Request) => {
  // Only the scheduler (which knows CRON_SECRET) may invoke this.
  if (!CRON_SECRET || req.headers.get('x-cron-secret') !== CRON_SECRET) {
    return new Response('Unauthorized', { status: 401 });
  }
  if (!RESEND_API_KEY) {
    return new Response('RESEND_API_KEY not configured', { status: 500 });
  }

  try {
    const candidates = await rpc<Candidate[]>('due_reminder_candidates', {});
    if (candidates.length === 0) {
      return Response.json({ ok: true, reminded: 0, emails: 0 });
    }

    // Group by assignee email → one digest each.
    const byEmail = new Map<string, Candidate[]>();
    for (const c of candidates) {
      const list = byEmail.get(c.email) ?? [];
      list.push(c);
      byEmail.set(c.email, list);
    }

    const sentCardIds: string[] = [];
    let emails = 0;
    for (const [email, cards] of byEmail) {
      const subject =
        cards.length === 1
          ? `Reminder: "${cards[0].title}" is ${dueLabel(cards[0].due_date)}`
          : `You have ${cards.length} tasks due soon`;
      const ok = await sendEmail(email, subject, renderEmail(cards[0].display_name, cards));
      if (ok) {
        emails++;
        sentCardIds.push(...cards.map((c) => c.card_id));
      }
    }

    // Only mark the cards we actually emailed, so a failed send retries next run.
    if (sentCardIds.length > 0) {
      await rpc('mark_reminders_sent', { p_card_ids: sentCardIds });
    }

    return Response.json({ ok: true, reminded: sentCardIds.length, emails });
  } catch (err) {
    console.error(err);
    return new Response(`Error: ${err instanceof Error ? err.message : String(err)}`, {
      status: 500,
    });
  }
});
