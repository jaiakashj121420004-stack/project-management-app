// Aurora — Stripe webhook receiver (Phase 10, billing).
//
// Stripe calls this whenever a subscription event happens. This is the ONLY
// place a profile's `plan` / `plan_status` / Stripe ids are flipped — the
// client redirect after checkout is never trusted. Deployed with
// `--no-verify-jwt` (Stripe can't send a Supabase JWT); authenticity is instead
// proven by verifying the Stripe signature on the raw body. Unverified input is
// rejected before any database write.
//
// This file runs on Deno (Supabase Edge Runtime), NOT in the Vite app bundle —
// it is excluded from the app's TypeScript/ESLint config on purpose.
//
// Required secrets (set with `supabase secrets set`, never committed):
//   STRIPE_SECRET_KEY     — Stripe secret API key (sk_...)
//   STRIPE_WEBHOOK_SECRET — signing secret for this endpoint (whsec_...)
// Provided automatically by the Edge runtime: SUPABASE_URL,
// SUPABASE_SERVICE_ROLE_KEY.

import Stripe from 'npm:stripe@^17';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY')!;
const STRIPE_WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;

// Stripe must use the Fetch HTTP client on Deno; the default Node client can't run here.
const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
});

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

Deno.serve(async (req: Request) => {
  // The signature is computed over the exact raw bytes, so read the body as text
  // and never parse it before verification.
  const rawBody = await req.text();
  const signature = req.headers.get('stripe-signature');
  if (!signature) return new Response('Missing stripe-signature header', { status: 400 });

  // SECURITY: prove the request really came from Stripe. On Deno we must use the
  // async + SubtleCrypto variant; the sync constructEvent does not work here. A
  // bad/forged signature throws and we bail with 400 before touching the DB.
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      rawBody,
      signature,
      STRIPE_WEBHOOK_SECRET,
      undefined,
      Stripe.createSubtleCryptoProvider(),
    );
  } catch (err) {
    console.error('Signature verification failed:', err instanceof Error ? err.message : err);
    return new Response('Webhook signature verification failed', { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        // Payment succeeded — promote the user to Pro and store their Stripe ids.
        // client_reference_id is the Supabase user id we set when creating the
        // session, so this is a trustworthy server-to-server mapping.
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.client_reference_id) {
          await patchProfile(`id=eq.${session.client_reference_id}`, {
            plan: 'pro',
            stripe_customer_id: session.customer,
            stripe_subscription_id: session.subscription,
            plan_status: 'active',
          });
        }
        break;
      }

      case 'customer.subscription.updated': {
        // Renewal, cancellation-at-period-end, past_due, etc. Keep plan_status in
        // sync and only grant Pro while the subscription is active or trialing.
        const subscription = event.data.object as Stripe.Subscription;
        const isPro = subscription.status === 'active' || subscription.status === 'trialing';
        await patchProfile(`stripe_customer_id=eq.${subscription.customer}`, {
          plan_status: subscription.status,
          plan: isPro ? 'pro' : 'free',
          stripe_subscription_id: subscription.id,
        });
        break;
      }

      case 'customer.subscription.deleted': {
        // Subscription fully ended — drop the user back to the free plan.
        const subscription = event.data.object as Stripe.Subscription;
        await patchProfile(`stripe_customer_id=eq.${subscription.customer}`, {
          plan: 'free',
          plan_status: 'canceled',
        });
        break;
      }

      // Any other event type is acknowledged but intentionally ignored, so Stripe
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
    // Return 500 so Stripe retries; the DB write is idempotent on retry.
    return new Response(`Error: ${err instanceof Error ? err.message : String(err)}`, {
      status: 500,
    });
  }
});
