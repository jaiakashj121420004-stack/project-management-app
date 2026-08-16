import { supabase } from '@/lib/supabase';

/**
 * Aurora's minimal funnel-analytics client. One call site API — `track()` — used
 * at the handful of moments listed in `reports/ANALYTICS.md`. Deliberately NOT a
 * general analytics SDK: no page-view auto-tracking, no session replay, no PII.
 *
 * Every event goes through the `track-event` Edge Function, which is the only
 * thing allowed to write `analytics_events` (RLS denies the client directly —
 * supabase/migrations/20260815120000_analytics_events.sql). `track()` itself:
 *   - never throws into the caller, on any failure (network, storage, whatever);
 *   - never blocks the UI — it's fire-and-forget, so call it inline in a click
 *     handler exactly like a `console.log`;
 *   - works for signed-in AND signed-out callers (supabase-js sends a valid JWT
 *     either way — the session token, or the project's anon key).
 */

/** The full set of events this app records. Keep in sync with ALLOWED_EVENTS in
 *  supabase/functions/track-event/index.ts and reports/ANALYTICS.md. */
export const ANALYTICS_EVENTS = [
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
] as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENTS)[number];

/** JSON-safe leaf values only — mirrors the Edge Function's `sanitizeProperties`
 *  (no nested objects/arrays), so a payload built here can never be rejected
 *  server-side for shape reasons. */
export type AnalyticsProperties = Record<string, string | number | boolean | null>;

const ANONYMOUS_ID_KEY = 'aurora-analytics-anonymous-id';
const ATTRIBUTION_KEY = 'aurora-analytics-attribution';
const ONCE_KEY_PREFIX = 'aurora-analytics-once:';

/** Events that should only ever fire once per browser (lifetime activation
 *  milestones, not per-project/per-board occurrences). Guarded with a
 *  localStorage flag so a page reload, StrictMode double-invoke, or a second
 *  project/card later in the session never double-counts them. */
const ONCE_PER_BROWSER = new Set<AnalyticsEventName>(['first_board_created', 'first_card_created']);

/** Events that should carry the visitor's first-touch UTM/referrer data, once
 *  captured (see `captureLandingAttribution`) — ties an anonymous landing-page
 *  visit to the signup it eventually produced. */
const CARRIES_ATTRIBUTION = new Set<AnalyticsEventName>(['signup_started', 'signup_completed']);

/** localStorage is unavailable in some contexts (private browsing, blocked
 *  storage, SSR-like edge cases) — every access goes through this so analytics
 *  degrades silently instead of ever throwing. */
function safeStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

// Falls back to a per-page-load id (not persisted) when storage is unavailable,
// so `track()` still has a stable id to send for the current page view.
let inMemoryAnonymousId: string | null = null;

/**
 * The random, non-PII id that ties this browser's events together (landing →
 * signup → first board → checkout). Minted once with `crypto.randomUUID()` and
 * persisted in localStorage. Exported (not just internal to `track`) because the
 * Dodo checkout flow needs to pass it through as Dodo metadata, so the webhook
 * can tag the eventual `checkout_completed` server-side event with the same id
 * — see `features/billing/api.ts`.
 */
export function getAnonymousId(): string {
  const storage = safeStorage();
  if (!storage) return (inMemoryAnonymousId ??= crypto.randomUUID());
  try {
    const existing = storage.getItem(ANONYMOUS_ID_KEY);
    if (existing) return existing;
    const fresh = crypto.randomUUID();
    storage.setItem(ANONYMOUS_ID_KEY, fresh);
    return fresh;
  } catch {
    return (inMemoryAnonymousId ??= crypto.randomUUID());
  }
}

/** Stored first-touch attribution (see `captureLandingAttribution`), or null if
 *  none was ever captured for this browser (e.g. the user's first visit landed
 *  somewhere other than "/"). */
function getStoredAttribution(): AnalyticsProperties | null {
  const storage = safeStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(ATTRIBUTION_KEY);
    return raw ? (JSON.parse(raw) as AnalyticsProperties) : null;
  } catch {
    return null;
  }
}

/**
 * Captures UTM params + referrer ONCE per browser, the first time the landing
 * page is seen — call this from `LandingPage` on mount. A no-op on every visit
 * after the first (so a returning visitor's later UTM-less session never
 * overwrites their original attribution). Stored alongside the anonymous id so
 * it can be merged into the `signup_started`/`signup_completed` properties
 * whenever the visitor eventually signs up (see `CARRIES_ATTRIBUTION` above).
 */
export function captureLandingAttribution(): void {
  const storage = safeStorage();
  if (!storage) return;
  try {
    if (storage.getItem(ATTRIBUTION_KEY)) return; // already captured — first touch wins
    const params = new URLSearchParams(window.location.search);
    const attribution: AnalyticsProperties = {
      utm_source: params.get('utm_source'),
      utm_medium: params.get('utm_medium'),
      utm_campaign: params.get('utm_campaign'),
      utm_term: params.get('utm_term'),
      utm_content: params.get('utm_content'),
      referrer: document.referrer || null,
      landing_path: window.location.pathname,
    };
    // Nothing worth keeping (direct visit, no campaign) — skip the write.
    if (Object.values(attribution).every((value) => value === null)) return;
    storage.setItem(ATTRIBUTION_KEY, JSON.stringify(attribution));
  } catch {
    // Storage unavailable/full — attribution is best-effort, never fatal.
  }
}

function hasFiredOnce(eventName: AnalyticsEventName): boolean {
  const storage = safeStorage();
  if (!storage) return false;
  try {
    return storage.getItem(ONCE_KEY_PREFIX + eventName) === '1';
  } catch {
    return false;
  }
}

function markFiredOnce(eventName: AnalyticsEventName): void {
  const storage = safeStorage();
  if (!storage) return;
  try {
    storage.setItem(ONCE_KEY_PREFIX + eventName, '1');
  } catch {
    // Best-effort — worst case a once-only event fires an extra time.
  }
}

/**
 * Record a funnel event. Fire-and-forget: call it inline, never `await` it,
 * never worry about it throwing. See the module doc comment for the full
 * contract. `properties` is optional and merged with first-touch attribution
 * for signup events (see `CARRIES_ATTRIBUTION`).
 */
export function track(eventName: AnalyticsEventName, properties: AnalyticsProperties = {}): void {
  try {
    if (ONCE_PER_BROWSER.has(eventName)) {
      if (hasFiredOnce(eventName)) return;
      // Mark BEFORE sending (not after the request resolves) so a page
      // navigation mid-flight can't leave the flag unset and cause a duplicate
      // on the next mount — this is a best-effort dedupe, not a hard guarantee.
      markFiredOnce(eventName);
    }

    const attribution = CARRIES_ATTRIBUTION.has(eventName) ? getStoredAttribution() : null;
    const body = {
      event_name: eventName,
      anonymous_id: getAnonymousId(),
      // Explicit properties win over stored attribution on key collisions.
      properties: { ...attribution, ...properties },
    };

    // supabase-js attaches the signed-in user's JWT if there is a session,
    // otherwise the anon key — either way the Edge Function accepts the call
    // and stamps user_id server-side from whichever it sees.
    void supabase.functions.invoke('track-event', { body }).catch(() => {
      // Analytics must never surface as a user-visible error.
    });
  } catch {
    // Belt-and-braces: track() must never throw into a call site.
  }
}
