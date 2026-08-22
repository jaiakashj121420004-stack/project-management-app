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

/**
 * The core acquisition funnel (landing -> signup -> first board -> paid),
 * all-time and last-30-day counts, admin only. Goes through the
 * `admin_analytics_funnel` RPC — never a direct `.from('analytics_events').select()`,
 * which RLS denies to every client role by design (see reports/ANALYTICS.md) —
 * so the read is logged to admin_audit_log and a non-admin gets a permission
 * error, not empty data.
 */
export async function fetchAnalyticsFunnel(): Promise<FunnelStage[]> {
  const { data, error } = await supabase.rpc('admin_analytics_funnel');
  if (error) throw error;
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
  const { data, error } = await supabase.rpc('admin_analytics_breakdown', {
    p_event_name: eventName,
    p_property_key: propertyKey,
    p_days: days,
  });
  if (error) throw error;
  return (data ?? []).map((row) => ({ value: row.value, count: Number(row.count) }));
}
