import { useQuery, type QueryKey } from '@tanstack/react-query';
import { fetchCardActivity, fetchProjectActivity } from './activity.api';

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

export function useProjectActivity(projectId: string | undefined) {
  return useQuery({
    queryKey: projectActivityKey(projectId ?? ''),
    enabled: Boolean(projectId),
    queryFn: () => fetchProjectActivity(projectId as string),
  });
}

export function useCardActivity(projectId: string | undefined, cardId: string | undefined) {
  return useQuery({
    queryKey: cardActivityKey(projectId ?? '', cardId ?? ''),
    enabled: Boolean(projectId) && Boolean(cardId),
    queryFn: () => fetchCardActivity(projectId as string, cardId as string),
  });
}
