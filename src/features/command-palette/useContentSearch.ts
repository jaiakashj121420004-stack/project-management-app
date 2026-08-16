import { useQuery } from '@tanstack/react-query';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { searchWorkspace, type ContentSearchResult } from './searchApi';

/**
 * Cap for the command palette's server-backed "Content matches" section —
 * deliberately smaller than the in-memory nav/content cap (`MAX_RESULTS` in
 * CommandPalette.tsx) since each of these results is a DB round trip, not a
 * filter over data already in memory, so a large workspace shouldn't flood
 * the panel with them.
 */
export const CONTENT_SEARCH_MAX_RESULTS = 8;

const DEBOUNCE_MS = 250;
const MIN_QUERY_LENGTH = 2;

/**
 * Debounced query-as-you-type full-text search for the palette's "Content
 * matches" section. The DB fetch only fires once the query has settled for
 * `DEBOUNCE_MS` and is at least `MIN_QUERY_LENGTH` characters, so the instant
 * client-side results above it stay instant and every keystroke doesn't hit
 * the DB — but the section itself (and its loading state) appears as soon as
 * the raw input crosses that length, so the palette doesn't feel like it's
 * ignoring the last couple of keystrokes while the debounce settles.
 * TanStack Query dedupes/caches by the debounced query string.
 */
export function useContentSearch(rawQuery: string) {
  const trimmedRaw = rawQuery.trim();
  const debouncedQuery = useDebouncedValue(trimmedRaw, DEBOUNCE_MS);

  const enabled = trimmedRaw.length >= MIN_QUERY_LENGTH;
  const fetchEnabled = debouncedQuery.length >= MIN_QUERY_LENGTH;
  // The debounce hasn't caught up to what's currently typed yet.
  const debouncePending = enabled && debouncedQuery !== trimmedRaw;

  const { data, isFetching } = useQuery<ContentSearchResult[]>({
    queryKey: ['search-workspace', debouncedQuery],
    queryFn: () => searchWorkspace(debouncedQuery, CONTENT_SEARCH_MAX_RESULTS),
    enabled: fetchEnabled,
    staleTime: 30_000,
  });

  return {
    // Only meaningful once the debounce has actually settled on this query.
    results: fetchEnabled && !debouncePending ? (data ?? []) : [],
    // True while the debounce is still catching up, or while the settled
    // query's request is in flight — covers the section's whole "working on
    // it" window, not just the network round trip.
    isLoading: enabled && (debouncePending || (fetchEnabled && isFetching)),
    // Whether the "Content matches" section should render at all — a query
    // long enough to search, shown immediately (not gated on the debounce),
    // so the section + its loading state appear right as the user crosses the
    // length threshold instead of lagging a beat behind.
    enabled,
  };
}
