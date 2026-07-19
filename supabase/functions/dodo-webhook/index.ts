// Aurora — Dodo Payments webhook receiver (billing).
//
// Dodo calls this whenever a subscription event happens. This is the ONLY place
// a profile's `plan` / `plan_status` / Dodo ids are flipped — the client
// redirect after checkout is never trusted. Deployed with `--no-verify-jwt`
// (Dodo can't send a Supabase JWT); authenticity is instead proven by verifying
// the Standard Webhooks signature over the raw body. Unverified input is
// rejected before any database write.
//
// This file runs on Deno (Supabase Edge Runtime), NOT in the Vite app bundle —
// it is excluded from the app's TypeScript/ESLint config on purpose.
//
// Required secrets (set with `supabase secrets set`, never committed):
//   DODO_WEBHOOK_SECRET — Standard Webhooks signing secret for this endpoint
// Optional secrets (harden which subscriptions may grant Pro):
//   DODO_PRODUCT_PRO_MONTHLY — Dodo product id for the MONTHLY Pro plan (pdt_…)
//   DODO_PRODUCT_PRO_ANNUAL  — Dodo product id for the YEARLY Pro plan (pdt_…)
//   DODO_BUSINESS_ID         — this endpoint's Dodo business id; when set, an
//                              event from any other business is rejected
// Provided automatically by the Edge runtime: SUPABASE_URL,
// SUPABASE_SERVICE_ROLE_KEY.

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const DODO_WEBHOOK_SECRET = Deno.env.get('DODO_WEBHOOK_SECRET')!;

// The only products that may flip an account to Pro. A future, cheaper product
// (or a typo'd id) must never grant Pro — so a grant event is honoured only when
// its product_id is one of these. When neither secret is configured the set is
// empty and NO product can grant Pro (fail closed), surfaced in the logs.
const PRO_PRODUCT_IDS = new Set(
  [Deno.env.get('DODO_PRODUCT_PRO_MONTHLY'), Deno.env.get('DODO_PRODUCT_PRO_ANNUAL')].filter(
    (id): id is string => typeof id === 'string' && id.length > 0,
  ),
);

// When set, only events from this Dodo business are accepted.
const EXPECTED_BUSINESS_ID = Deno.env.get('DODO_BUSINESS_ID') ?? '';

// In live mode DODO_BUSINESS_ID is REQUIRED (fail closed): without it we can't
// prove an event is for our business, so we reject rather than trust the HMAC
// alone. Test/dev stays ergonomic — an unset id is allowed there (L2).
const IS_LIVE = (Deno.env.get('DODO_PAYMENTS_ENVIRONMENT') ?? 'test')
  .toLowerCase()
  .startsWith('live');

// Reject events whose timestamp is more than this far from now (replay defence).
const TOLERANCE_SECONDS = 60 * 5;

// Canonical v4 UUID shape — metadata.user_id is server-set (never client input)
// and signature-gated, but we still validate it before interpolating it into a
// PostgREST filter, so a malformed id can never widen the query.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

/** Constant-time string comparison so signature checks can't be timed. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Verify a Dodo webhook using the Standard Webhooks scheme:
 *   signed content = `${webhook-id}.${webhook-timestamp}.${rawBody}`
 *   signature      = base64( HMAC-SHA256( base64decode(secret), signedContent ) )
 * The secret is `whsec_<base64>`; the bytes after the prefix are the HMAC key.
 * The `webhook-signature` header is a space-separated list of `v1,<sig>` pairs.
 */
async function verifySignature(
  secret: string,
  id: string,
  timestamp: string,
  signatureHeader: string,
  body: string,
): Promise<boolean> {
  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;
  if (Math.abs(Math.floor(Date.now() / 1000) - ts) > TOLERANCE_SECONDS) return false;

  const rawSecret = secret.startsWith('whsec_') ? secret.slice('whsec_'.length) : secret;
  const key = await crypto.subtle.importKey(
    'raw',
    base64ToBytes(rawSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${id}.${timestamp}.${body}`));
  const expected = bytesToBase64(new Uint8Array(mac));

  // Any one of the listed signatures matching ours proves authenticity.
  return signatureHeader.split(' ').some((entry) => {
    const comma = entry.indexOf(',');
    const provided = comma === -1 ? entry : entry.slice(comma + 1);
    return timingSafeEqual(provided, expected);
  });
}

interface DodoSubscriptionData {
  payload_type?: string;
  subscription_id?: string;
  status?: string;
  customer?: { customer_id?: string; email?: string | null };
  metadata?: Record<string, string> | null;
  product_id?: string;
}

interface DodoEvent {
  business_id?: string;
  type?: string;
  timestamp?: string;
  data?: DodoSubscriptionData;
}

/**
 * Patch a profile row with the service role. Billing columns are blocked for
 * normal users by a DB trigger, so the service role key is mandatory here.
 * `filter` is a PostgREST query string, e.g. `id=eq.<uuid>`.
 */
async function patchProfile(filter: string, changes: Record<string, unknown>): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/profiles?${filter}`, {
    method: 'PATCH',
    headers: {
      apikey: SERVICE_ROLE,
      Authorization: `Bearer ${SERVICE_ROLE}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(changes),
  });
  if (!res.ok) throw new Error(`Profile update failed: ${res.status} ${await res.text()}`);
}

/**
 * Record this event's Standard-Webhooks `webhook-id` so a replay is a no-op (L3).
 * Returns 'duplicate' when the id was already stored (unique-violation → 409),
 * 'new' when freshly recorded, or 'error' on any store failure. On 'error' the
 * caller proceeds anyway — the DB writes are already idempotent, so the store is a
 * belt-and-braces optimisation and must not block a genuine event.
 */
async function markWebhookProcessed(webhookId: string): Promise<'new' | 'duplicate' | 'error'> {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/processed_webhooks`, {
      method: 'POST',
      headers: {
        apikey: SERVICE_ROLE,
        Authorization: `Bearer ${SERVICE_ROLE}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ webhook_id: webhookId }),
    });
    if (res.status === 201 || res.status === 204) return 'new';
    if (res.status === 409) return 'duplicate';
    console.error(`processed_webhooks insert unexpected status ${res.status}: ${await res.text()}`);
    return 'error';
  } catch (err) {
    console.error('processed_webhooks insert error', err);
    return 'error';
  }
}

/**
 * Identify which profile an event refers to. The Supabase user id travels in the
 * checkout metadata (and stays on the subscription), so it's the primary key;
 * we fall back to the stored Dodo subscription / customer id for later events.
 * Returns a PostgREST filter, or null when the event can't be mapped.
 */
function resolveProfileFilter(data: DodoSubscriptionData): string | null {
  const userId = data.metadata?.user_id;
  // Only trust user_id when it is a well-formed UUID; otherwise fall back to the
  // Dodo ids so a malformed metadata value can never reshape the filter.
  if (isUuid(userId)) return `id=eq.${userId}`;
  if (data.subscription_id) return `dodo_subscription_id=eq.${encodeURIComponent(data.subscription_id)}`;
  if (data.customer?.customer_id)
    return `dodo_customer_id=eq.${encodeURIComponent(data.customer.customer_id)}`;
  return null;
}

Deno.serve(async (req: Request) => {
  // The signature is computed over the exact raw bytes, so read the body as text
  // and never parse it before verification.
  const rawBody = await req.text();
  const id = req.headers.get('webhook-id');
  const timestamp = req.headers.get('webhook-timestamp');
  const signature = req.headers.get('webhook-signature');
  if (!id || !timestamp || !signature) {
    return new Response('Missing webhook signature headers', { status: 400 });
  }

  // SECURITY: prove the request really came from Dodo before touching the DB.
  const valid = await verifySignature(DODO_WEBHOOK_SECRET, id, timestamp, signature, rawBody);
  if (!valid) {
    return new Response('Webhook signature verification failed', { status: 400 });
  }

  let event: DodoEvent;
  try {
    event = JSON.parse(rawBody) as DodoEvent;
  } catch {
    return new Response('Invalid JSON body', { status: 400 });
  }

  // Every genuine Dodo event carries the business id. Require it, and — when we
  // know our own business id — require it to match, so an event minted for a
  // different (or missing) business can never touch our data.
  if (!event.business_id) {
    return new Response('Missing business_id', { status: 400 });
  }
  if (EXPECTED_BUSINESS_ID) {
    if (event.business_id !== EXPECTED_BUSINESS_ID) {
      return new Response('Unexpected business_id', { status: 400 });
    }
  } else if (IS_LIVE) {
    // L2 — fail closed: in live mode we must know our own business id to accept.
    console.error('DODO_BUSINESS_ID is not set in a live environment — rejecting webhook (L2).');
    return new Response('Server not configured', { status: 500 });
  }

  // L3 — replay defence: if we've already processed this webhook-id, acknowledge
  // and stop (no reprocessing). A store error is non-fatal — the writes below are
  // idempotent — so we fall through and process as normal.
  const seen = await markWebhookProcessed(id);
  if (seen === 'duplicate') {
    return new Response(JSON.stringify({ received: true, duplicate: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const data = event.data ?? {};
    const filter = resolveProfileFilter(data);

    switch (event.type) {
      // Subscription is live (first activation) or successfully renewed — grant
      // Pro and store the Dodo ids so later events can be mapped without metadata.
      case 'subscription.active':
      case 'subscription.renewed': {
        if (!filter) break;
        // Only a KNOWN Pro product may grant Pro. Anything else (a future cheaper
        // product, a mispriced test product, a typo) is acknowledged but never
        // upgrades the account.
        if (!data.product_id || !PRO_PRODUCT_IDS.has(data.product_id)) {
          console.warn(`Ignoring ${event.type} for unrecognised product_id: ${data.product_id}`);
          break;
        }
        await patchProfile(filter, {
          plan: 'pro',
          plan_status: 'active',
          dodo_customer_id: data.customer?.customer_id ?? null,
          dodo_subscription_id: data.subscription_id ?? null,
        });
        break;
      }

      // A renewal failed and Dodo is retrying — keep Pro during the grace period
      // but flag the account so the UI can surface a "past due" state.
      case 'subscription.on_hold': {
        if (!filter) break;
        await patchProfile(filter, { plan_status: 'past_due' });
        break;
      }

      // Terminal end states — drop the user back to Free. `failed` means Dodo
      // could never set up the mandate, so Pro is never granted for it.
      case 'subscription.cancelled':
      case 'subscription.expired':
      case 'subscription.failed': {
        if (!filter) break;
        await patchProfile(filter, {
          plan: 'free',
          plan_status: event.type.slice('subscription.'.length),
        });
        break;
      }

      // Any other event type is acknowledged but intentionally ignored, so Dodo
      // does not keep retrying it.
      default:
        break;
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error(err);
    // Return 500 so Dodo retries; the DB write is idempotent on retry.
    return new Response(`Error: ${err instanceof Error ? err.message : String(err)}`, {
      status: 500,
    });
  }
});
