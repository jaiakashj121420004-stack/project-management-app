import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import type { Comment } from '@/types/database';
import {
  deleteComment,
  editComment,
  fetchCardComments,
  postComment,
  type PostCommentInput,
} from './comments.api';

/**
 * A card's thread lives in one cache entry, `['comments', projectId, cardId]`.
 * The projectId is in the key so useProjectRealtime can invalidate every open
 * thread for a project with a prefix match. Add/edit/delete are optimistic so
 * the thread feels instant, reconciling to the server row (or rolling back).
 */
const commentsKey = (projectId: string, cardId: string): QueryKey => [
  'comments',
  projectId,
  cardId,
];

export function useCardComments(projectId: string | undefined, cardId: string | undefined) {
  return useQuery({
    queryKey: commentsKey(projectId ?? '', cardId ?? ''),
    enabled: Boolean(projectId) && Boolean(cardId),
    queryFn: () => fetchCardComments(cardId as string),
  });
}

interface CommentsContext {
  previous?: Comment[];
}

export function usePostComment(projectId: string, cardId: string) {
  const queryClient = useQueryClient();
  const key = commentsKey(projectId, cardId);

  return useMutation<
    Comment,
    Error,
    Omit<PostCommentInput, 'projectId' | 'cardId'> & { tempId: string },
    CommentsContext
  >({
    mutationFn: ({ authorId, body, parentId, mentionedUserIds }) =>
      postComment({ projectId, cardId, authorId, body, parentId, mentionedUserIds }),
    onMutate: async ({ authorId, body, parentId, tempId }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Comment[]>(key);
      queryClient.setQueryData<Comment[]>(key, (old) => [
        ...(old ?? []),
        {
          id: tempId,
          project_id: projectId,
          card_id: cardId,
          canvas_note_id: null,
          author_id: authorId,
          body,
          parent_id: parentId,
          created_at: new Date().toISOString(),
          edited_at: null,
        },
      ]);
      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },
    onSuccess: (created, { tempId }) => {
      queryClient.setQueryData<Comment[]>(key, (old) =>
        (old ?? []).map((comment) => (comment.id === tempId ? created : comment)),
      );
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: key });
    },
  });
}

export function useEditComment(projectId: string, cardId: string) {
  const queryClient = useQueryClient();
  const key = commentsKey(projectId, cardId);

  return useMutation<Comment, Error, { id: string; body: string }, CommentsContext>({
    mutationFn: ({ id, body }) => editComment(id, body),
    onMutate: async ({ id, body }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Comment[]>(key);
      queryClient.setQueryData<Comment[]>(key, (old) =>
        (old ?? []).map((comment) =>
          comment.id === id
            ? { ...comment, body, edited_at: new Date().toISOString() }
            : comment,
        ),
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

export function useDeleteComment(projectId: string, cardId: string) {
  const queryClient = useQueryClient();
  const key = commentsKey(projectId, cardId);

  return useMutation<void, Error, { id: string }, CommentsContext>({
    mutationFn: ({ id }) => deleteComment(id),
    onMutate: async ({ id }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Comment[]>(key);
      // Drop the comment and any replies to it (the DB cascades the same way).
      queryClient.setQueryData<Comment[]>(key, (old) =>
        (old ?? []).filter((comment) => comment.id !== id && comment.parent_id !== id),
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
