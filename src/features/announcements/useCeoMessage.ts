import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import type { CeoMessage } from '@/types/database';
import { fetchLatestCeoMessage, saveCeoMessage } from './api';

/** Cache key for the single current CEO message. */
const ceoMessageKey: QueryKey = ['ceo-message'];

/** The latest CEO message (every signed-in user can read it; RLS, plan.md §6). */
export function useCeoMessage() {
  return useQuery({
    queryKey: ceoMessageKey,
    queryFn: fetchLatestCeoMessage,
  });
}

/** Post or update the CEO message (admin only), then refresh it for everyone. */
export function useSaveCeoMessage() {
  const queryClient = useQueryClient();

  return useMutation<CeoMessage, Error, string>({
    mutationFn: (message) => saveCeoMessage(message),
    onSuccess: (saved) => {
      queryClient.setQueryData<CeoMessage | null>(ceoMessageKey, saved);
      void queryClient.invalidateQueries({ queryKey: ceoMessageKey });
    },
  });
}
