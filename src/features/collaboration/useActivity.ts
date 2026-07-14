import { useInfiniteQuery, useQuery, type QueryKey } from '@tanstack/react-query';
import type { ActivityEntry } from '@/types/database';
import {
  ACTIVITY_PAGE_SIZE,
  fetchCardActivity,
  fetchProjectActivity,
  fetchProjectActivityPage,
} from './activity.api';

/**
 * Read-only activity feeds. The project feed keys on `['activity', projectId]`
 * and the per-card feed on `['activity', projectId, cardId]`, so
 * useProjectRealtime invalidates both with a prefix match when the log changes.
 */
const projectActivityKey = (projectId: string): QueryKey => ['activity', projectId];
const cardActivityKey = (projectId: string, cardId: string): QueryKey => [
  'activity',
  projectId,
  cardId,
];

/**
 * Non-paged project feed (kept for callers that only want the newest slice).
 * The project *panel* uses the infinite version below.
 */
export function useProjectActivity(projectId: string | undefined) {
  return useQuery({
    queryKey: projectActivityKey(projectId ?? ''),
    enabled: Boolean(projectId),
    queryFn: () => fetchProjectActivity(projectId as string),
  });
}

/**
 * Infinite project activity feed. Shares the `['activity', projectId]` key prefix
 * so a Realtime insert still invalidates it (TanStack refetches every loaded page
 * in order, so newly-arrived rows appear on top without disturbing pagination).
 * The next-page cursor is the oldest loaded entry's `created_at`; a short final
 * page (< PAGE_SIZE) means there's nothing older to load.
 */
export function useProjectActivityInfinite(projectId: string | undefined) {
  return useInfiniteQuery({
    queryKey: [...projectActivityKey(projectId ?? ''), 'infinite'] as QueryKey,
    enabled: Boolean(projectId),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      fetchProjectActivityPage({ projectId: projectId as string, before: pageParam }),
    getNextPageParam: (lastPage: ActivityEntry[]) =>
      lastPage.length < ACTIVITY_PAGE_SIZE ? undefined : lastPage[lastPage.length - 1]?.created_at,
  });
}

export function useCardActivity(projectId: string | undefined, cardId: string | undefined) {
  return useQuery({
    queryKey: cardActivityKey(projectId ?? '', cardId ?? ''),
    enabled: Boolean(projectId) && Boolean(cardId),
    queryFn: () => fetchCardActivity(projectId as string, cardId as string),
  });
}
