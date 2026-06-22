import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import type { Reaction, ReactionTarget } from '@/types/database';
import { addReaction, fetchReactions, removeReaction } from './reactions.api';

/**
 * Reactions for one target live in `['reactions', targetType, targetId]`.
 * Add/remove are optimistic so an emoji toggles instantly. useProjectRealtime
 * invalidates the `['reactions']` prefix on any change so reactions stream in.
 */
const reactionsKey = (targetType: ReactionTarget, targetId: string): QueryKey => [
  'reactions',
  targetType,
  targetId,
];

export function useReactions(targetType: ReactionTarget, targetId: string | undefined) {
  return useQuery({
    queryKey: reactionsKey(targetType, targetId ?? ''),
    enabled: Boolean(targetId),
    queryFn: () => fetchReactions(targetType, targetId as string),
  });
}

interface ReactionsContext {
  previous?: Reaction[];
}

export function useAddReaction(targetType: ReactionTarget, targetId: string) {
  const queryClient = useQueryClient();
  const key = reactionsKey(targetType, targetId);

  return useMutation<Reaction, Error, { emoji: string; userId: string; tempId: string }, ReactionsContext>({
    mutationFn: ({ emoji, userId }) => addReaction({ targetType, targetId, userId, emoji }),
    onMutate: async ({ emoji, userId, tempId }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Reaction[]>(key);
      queryClient.setQueryData<Reaction[]>(key, (old) => [
        ...(old ?? []),
        {
          id: tempId,
          target_type: targetType,
          target_id: targetId,
          user_id: userId,
          emoji,
          created_at: new Date().toISOString(),
        },
      ]);
      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },
    onSuccess: (created, { tempId }) => {
      queryClient.setQueryData<Reaction[]>(key, (old) =>
        (old ?? []).map((reaction) => (reaction.id === tempId ? created : reaction)),
      );
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: key });
    },
  });
}

export function useRemoveReaction(targetType: ReactionTarget, targetId: string) {
  const queryClient = useQueryClient();
  const key = reactionsKey(targetType, targetId);

  return useMutation<void, Error, { id: string }, ReactionsContext>({
    mutationFn: ({ id }) => removeReaction(id),
    onMutate: async ({ id }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Reaction[]>(key);
      queryClient.setQueryData<Reaction[]>(key, (old) =>
        (old ?? []).filter((reaction) => reaction.id !== id),
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
