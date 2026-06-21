import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import type { Feedback } from '@/types/database';
import { fetchAllFeedback, submitFeedback, type NewFeedback } from './api';

/** Cache key for the admin's feedback inbox (the full list, RLS-scoped). */
const allFeedbackKey: QueryKey = ['feedback', 'all'];

/** Send a feedback / feature submission, then refresh the admin inbox. */
export function useSubmitFeedback() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation<Feedback, Error, Omit<NewFeedback, 'userId'>>({
    mutationFn: (input) => submitFeedback({ ...input, userId: user?.id }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: allFeedbackKey });
    },
  });
}

/** All submissions for the admin inbox (RLS returns everything only to admin). */
export function useAllFeedback() {
  return useQuery({
    queryKey: allFeedbackKey,
    queryFn: fetchAllFeedback,
  });
}
