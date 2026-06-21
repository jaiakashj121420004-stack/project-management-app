import { QueryClient } from '@tanstack/react-query';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';

/**
 * The app's single QueryClient plus a localStorage persister (Phase 9).
 *
 * Persisting the cache is what gives us a **read-only offline view**: the last
 * data the user saw is restored on the next load, even with no network, so the
 * cached app shell shows real boards/projects instead of empty skeletons.
 *
 * `gcTime` must outlive `maxAge` (below) or queries are garbage-collected before
 * they can be restored. Freshness is unchanged: `staleTime` stays at the default
 * 0, so when online every query still refetches on mount and Realtime keeps
 * invalidating — the persisted copy is purely a cold-start / offline fallback.
 *
 * Privacy: the cache can hold another user's data on a shared device, so it is
 * wiped on sign-out (see AuthProvider + clearPersistedCache()).
 */
export const PERSIST_KEY = 'aurora-query-cache';

/** Bump to invalidate every persisted cache after a breaking data-shape change. */
export const PERSIST_BUSTER = 'v1';

export const PERSIST_MAX_AGE = 1000 * 60 * 60 * 24; // 24h

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: PERSIST_MAX_AGE,
    },
  },
});

export const persister = createSyncStoragePersister({
  storage: window.localStorage,
  key: PERSIST_KEY,
});

/** Drop in-memory + persisted caches (called on sign-out so nothing leaks). */
export function clearPersistedCache(): void {
  queryClient.clear();
  void persister.removeClient();
}
