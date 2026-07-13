import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import type { Note } from '@/types/database';
import { fetchNotes, insertNote, patchNote, removeNote } from './api';

/**
 * A project's notes live in a single cache entry, `['notes', projectId]` →
 * Note[] — the same one-snapshot strategy as the board and to-do planner. Every
 * mutation patches that snapshot optimistically and rolls back as a unit on
 * error, so typing in the editor feels instant and the autosave never blocks the
 * UI. The list is kept newest-edited-first (updated_at desc).
 */

const notesKey = (projectId: string): QueryKey => ['notes', projectId];

interface NotesContext {
  previous?: Note[];
}

export function useNotes(projectId: string) {
  return useQuery({
    queryKey: notesKey(projectId),
    queryFn: () => fetchNotes(projectId),
  });
}

/** Shared optimistic plumbing: snapshot → patch → rollback-on-error → refetch. */
function useNotesMutation<TData, TVariables>(
  projectId: string,
  mutationFn: (variables: TVariables) => Promise<TData>,
  patch: (notes: Note[], variables: TVariables) => Note[],
  reconcile?: (notes: Note[], result: TData, variables: TVariables) => Note[],
) {
  const queryClient = useQueryClient();
  const key = notesKey(projectId);

  return useMutation<TData, Error, TVariables, NotesContext>({
    mutationFn,
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Note[]>(key);
      queryClient.setQueryData<Note[]>(key, (old) => patch(old ?? [], variables));
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },
    onSuccess: (result, variables) => {
      if (reconcile) {
        queryClient.setQueryData<Note[]>(key, (old) =>
          old ? reconcile(old, result, variables) : old,
        );
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: key });
    },
  });
}

export function useAddNote(projectId: string) {
  const { user } = useAuth();
  return useNotesMutation<Note, { title: string; tempId: string }>(
    projectId,
    ({ title }) => insertNote({ projectId, title }),
    (notes, { title, tempId }) => {
      const now = new Date().toISOString();
      return [
        {
          id: tempId,
          project_id: projectId,
          owner_id: user?.id ?? '',
          folder_id: null,
          title: title.trim(),
          content: '',
          content_json: null,
          updated_at: now,
          created_at: now,
        },
        ...notes,
      ];
    },
    (notes, created, { tempId }) =>
      notes.map((note) => (note.id === tempId ? created : note)),
  );
}

/** Autosave path: patch a note's title and/or content; bumps updated_at locally
 *  so the list re-sorts immediately (the DB trigger sets the canonical value). */
export function useUpdateNote(projectId: string) {
  return useNotesMutation<
    Note,
    { id: string; title?: string; content?: string; content_json?: Record<string, unknown> | null }
  >(
    projectId,
    ({ id, ...rest }) => patchNote(id, rest),
    (notes, { id, title, content, content_json }) =>
      notes.map((note) =>
        note.id === id
          ? {
              ...note,
              ...(title !== undefined ? { title: title.trim() } : {}),
              ...(content !== undefined ? { content } : {}),
              ...(content_json !== undefined ? { content_json } : {}),
              updated_at: new Date().toISOString(),
            }
          : note,
      ),
    (notes, updated) => notes.map((note) => (note.id === updated.id ? updated : note)),
  );
}

export function useDeleteNote(projectId: string) {
  return useNotesMutation<void, { id: string }>(
    projectId,
    ({ id }) => removeNote(id),
    (notes, { id }) => notes.filter((note) => note.id !== id),
  );
}
