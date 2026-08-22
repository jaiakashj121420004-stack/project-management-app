import { useQuery } from '@tanstack/react-query';
import { fetchAnalyticsBreakdown, fetchAnalyticsFunnel } from './api';

/** The core acquisition funnel — admin only. Cheap to refetch; 5-minute stale time
 *  avoids hammering the RPC while the dashboard tab sits open in the background. */
export function useAnalyticsFunnel() {
  return useQuery({
    queryKey: ['admin-analytics', 'funnel'],
    queryFn: fetchAnalyticsFunnel,
    staleTime: 5 * 60 * 1000,
  });
}

/** A single event property's value breakdown over the last `days` days, admin only. */
export function useAnalyticsBreakdown(eventName: string, propertyKey: string, days = 30) {
  return useQuery({
    queryKey: ['admin-analytics', 'breakdown', eventName, propertyKey, days],
    queryFn: () => fetchAnalyticsBreakdown(eventName, propertyKey, days),
    staleTime: 5 * 60 * 1000,
  });
}
