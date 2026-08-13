import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { enableFeed, fetchFeedToken, revokeFeedToken, rotateFeedToken } from './api';

const key = (userId: string | undefined) => ['calendar-feed-token', userId] as const;

/** The caller's current ICS subscribe token, or null when the feed is off. */
export function useFeedToken() {
  const { user } = useAuth();
  return useQuery({
    queryKey: key(user?.id),
    enabled: Boolean(user?.id),
    queryFn: fetchFeedToken,
    // Rarely changes and isn't worth refetching aggressively; the mutations
    // below keep the cache in sync directly.
    staleTime: 5 * 60 * 1000,
  });
}

/** Turns the feed on, sets one for the first time, or rotates the token — all
 * three just write the query cache with whatever the server returns. */
function useSetFeedToken(mutationFn: () => Promise<string | null>) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (token) => {
      queryClient.setQueryData(key(user?.id), token);
    },
  });
}

export function useEnableFeed() {
  return useSetFeedToken(enableFeed);
}

export function useRotateFeedToken() {
  return useSetFeedToken(rotateFeedToken);
}

export function useRevokeFeedToken() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: revokeFeedToken,
    onSuccess: () => {
      queryClient.setQueryData(key(user?.id), null);
    },
  });
}
