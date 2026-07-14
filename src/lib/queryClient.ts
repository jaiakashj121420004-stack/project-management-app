import { MutationCache, QueryClient } from '@tanstack/react-query';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { toast } from '@/components/feedback/toast';

/**
 * Optional per-mutation metadata read by the global error handler below.
 * A hook can set `meta: { errorMessage: '…' }` for a tailored message, or
 * `meta: { suppressErrorToast: true }` when it surfaces its own error UI
 * (e.g. an inline banner) so the user isn't told twice.
 */
declare module '@tanstack/react-query' {
  interface Register {
    mutationMeta: {
      errorMessage?: string;
      suppressErrorToast?: boolean;
    };
  }
}

/** Default copy when a mutation fails and the hook didn't provide its own. */
const DEFAULT_MUTATION_ERROR = "Couldn't save your changes. Please try again.";

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
  // Global write-failure feedback (Phase 2 resilience). Every mutation's optimistic
  // `onError` still rolls the cache back; this adds the *visible* half so a failed
  // card move / rename / etc. no longer snaps back silently. Hooks that render their
  // own error UI opt out via `meta.suppressErrorToast`.
  mutationCache: new MutationCache({
    onError: (_error, _variables, _context, mutation) => {
      if (mutation.meta?.suppressErrorToast) return;
      // Prefer the hook's own copy; otherwise a friendly default (raw Supabase
      // messages like "new row violates row-level security policy" aren't for users).
      toast.error(mutation.meta?.errorMessage ?? DEFAULT_MUTATION_ERROR);
    },
  }),
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
