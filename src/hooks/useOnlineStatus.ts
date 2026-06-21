import { useEffect, useState } from 'react';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const PROBE_URL = `${SUPABASE_URL}/auth/v1/health`;
const PROBE_INTERVAL_MS = 30_000;
const PROBE_TIMEOUT_MS = 6_000;

/**
 * Whether the app can actually reach its backend — not merely whether the OS
 * reports a network interface. `navigator.onLine` is unreliable on desktop: it
 * stays `true` on a "connected, but no internet" network (common on Windows),
 * so the offline banner never triggered. We treat the browser as offline if
 * `navigator.onLine` is false OR a lightweight no-cors probe to Supabase fails.
 * Re-checks on the online/offline events, when the tab becomes visible, and on
 * a slow interval. Used by the offline banner and to pause reminder polling.
 */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState<boolean>(() => navigator.onLine);

  useEffect(() => {
    let cancelled = false;
    const apply = (value: boolean) => {
      if (!cancelled) setOnline(value);
    };

    async function probe(): Promise<void> {
      if (!navigator.onLine) {
        apply(false);
        return;
      }
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
      try {
        // no-cors: we only care whether the request reaches the server, not the
        // response body. Resolves when online, rejects on a network failure.
        await fetch(PROBE_URL, {
          method: 'GET',
          mode: 'no-cors',
          cache: 'no-store',
          signal: controller.signal,
        });
        apply(true);
      } catch {
        apply(false);
      } finally {
        window.clearTimeout(timer);
      }
    }

    const handleOffline = () => apply(false);
    const handleOnline = () => void probe();
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') void probe();
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    document.addEventListener('visibilitychange', handleVisibility);
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') void probe();
    }, PROBE_INTERVAL_MS);

    void probe();

    return () => {
      cancelled = true;
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.clearInterval(interval);
    };
  }, []);

  return online;
}
