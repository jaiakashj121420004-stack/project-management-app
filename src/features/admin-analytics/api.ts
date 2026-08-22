/**
 * Rebuilt 2026-08-22: calls the two admin analytics RPCs with a plain
 * `fetch()` instead of `supabase.rpc()`. Every header is explicit here — the
 * apikey, and the current session's access token (falling back to the anon
 * key when signed out) — instead of letting the supabase-js client build the
 * request internally. This is deliberate: the RPCs themselves were verified
 * correct and reachable via curl with full control over every header, but
 * `.rpc()` calls from inside the running app kept failing with 405 Method Not
 * Allowed in a way no direct test of the endpoint ever reproduced. Bypassing
 * the client library's request-building for these two calls removes that as
 * a variable entirely.
 */
import { supabase } from '@/lib/supabase';

/** One stage of the core acquisition funnel, in stage order (not alphabetical). */
export interface FunnelStage {
  stage: number;
  eventName: string;
  countAllTime: number;
  countLast30d: number;
}

/** One value of a property breakdown (e.g. which plan limit triggered a prompt). */
export interface BreakdownRow {
  value: string;
  count: number;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * Calls a Postgres RPC directly via the REST API, bypassing supabase-js's
 * `.rpc()` wrapper. Attaches the current session's access token when signed
 * in (required — both RPCs are granted to `authenticated` only, not `anon`),
 * falling back to the anon key when there's no session. Throws an `Error`
 * whose `message` includes the real HTTP status and response body on any
 * non-2xx response, so a failure here is never a silent, unexplained one.
 */
async function callAdminAnalyticsRpc<T>(
  fnName: 'admin_analytics_funnel' | 'admin_analytics_breakdown',
  params: Record<string, unknown> = {},
): Promise<T> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY.');
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const accessToken = session?.access_token ?? SUPABASE_ANON_KEY;

  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fnName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const bodyText = await response.text().catch(() => '');
    throw new Error(`${fnName} failed: HTTP ${response.status} ${response.statusText} — ${bodyText}`);
  }

  return response.json() as Promise<T>;
}

/**
 * The core acquisition funnel (landing -> signup -> first board -> paid),
 * all-time and last-30-day counts, admin only. Goes through the
 * `admin_analytics_funnel` RPC — never a direct `.from('analytics_events').select()`,
 * which RLS denies to every client role by design (see reports/ANALYTICS.md) —
 * so the read is logged to admin_audit_log and a non-admin gets a permission
 * error, not empty data.
 */
export async function fetchAnalyticsFunnel(): Promise<FunnelStage[]> {
  const data = await callAdminAnalyticsRpc<
    Array<{ stage: number; event_name: string; count_all_time: number | string; count_last_30d: number | string }>
  >('admin_analytics_funnel');
  return (data ?? []).map((row) => ({
    stage: row.stage,
    eventName: row.event_name,
    countAllTime: Number(row.count_all_time),
    countLast30d: Number(row.count_last_30d),
  }));
}

/**
 * Value counts for one event's property over the last `days` days (default
 * 30), highest first, capped to the top 20 — e.g. which plan limit fires
 * `upgrade_prompt_shown` most, or which platform sees `install_prompt_shown`.
 * Admin only, same RPC-not-direct-select pattern as the funnel above.
 */
export async function fetchAnalyticsBreakdown(
  eventName: string,
  propertyKey: string,
  days = 30,
): Promise<BreakdownRow[]> {
  const data = await callAdminAnalyticsRpc<Array<{ value: string; count: number | string }>>(
    'admin_analytics_breakdown',
    { p_event_name: eventName, p_property_key: propertyKey, p_days: days },
  );
  return (data ?? []).map((row) => ({ value: row.value, count: Number(row.count) }));
}
