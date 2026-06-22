import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import type { CardReminder, ReminderChannel } from '@/types/database';
import {
  deleteCardReminder,
  fetchCardReminders,
  insertCardReminder,
} from './cardReminders.api';

/**
 * A card's custom reminders live in their own cache entry, `['card-reminders',
 * cardId]`. Add/remove are optimistic so the chips feel instant, and reconcile
 * to the server row (or roll back) — the same pattern the board uses.
 */

const reminderKey = (cardId: string): QueryKey => ['card-reminders', cardId];

export function useCardReminders(cardId: string | undefined) {
  return useQuery({
    queryKey: reminderKey(cardId ?? ''),
    enabled: Boolean(cardId),
    queryFn: () => fetchCardReminders(cardId as string),
  });
}

interface RemindersContext {
  previous?: CardReminder[];
}

export function useAddCardReminder(cardId: string) {
  const queryClient = useQueryClient();
  const key = reminderKey(cardId);

  return useMutation<
    CardReminder,
    Error,
    { offsetMinutes: number; channel: ReminderChannel; createdBy: string; tempId: string },
    RemindersContext
  >({
    mutationFn: ({ offsetMinutes, channel, createdBy }) =>
      insertCardReminder({ cardId, offsetMinutes, channel, createdBy }),
    onMutate: async ({ offsetMinutes, channel, createdBy, tempId }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<CardReminder[]>(key);
      queryClient.setQueryData<CardReminder[]>(key, (old) => [
        ...(old ?? []),
        {
          id: tempId,
          card_id: cardId,
          offset_minutes: offsetMinutes,
          channel,
          created_by: createdBy,
          created_at: new Date().toISOString(),
        },
      ]);
      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },
    onSuccess: (created, { tempId }) => {
      queryClient.setQueryData<CardReminder[]>(key, (old) =>
        (old ?? []).map((reminder) => (reminder.id === tempId ? created : reminder)),
      );
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: key });
    },
  });
}

export function useDeleteCardReminder(cardId: string) {
  const queryClient = useQueryClient();
  const key = reminderKey(cardId);

  return useMutation<void, Error, { id: string }, RemindersContext>({
    mutationFn: ({ id }) => deleteCardReminder(id),
    onMutate: async ({ id }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<CardReminder[]>(key);
      queryClient.setQueryData<CardReminder[]>(key, (old) =>
        (old ?? []).filter((reminder) => reminder.id !== id),
      );
      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: key });
    },
  });
}
