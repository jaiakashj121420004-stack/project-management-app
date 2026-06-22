import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import type { CanvasNote } from '@/types/database';
import type { PageType } from '@/lib/canvasPages';
import type { CanvasScene } from './elements';
import {
  fetchCanvas,
  fetchCanvasList,
  insertCanvas,
  patchCanvas,
  removeCanvas,
  type CanvasNoteSummary,
} from './api';

/**
 * Two caches back the canvas feature, mirroring the notes module's strategy:
 *   - ['canvas-list', projectId] → CanvasNoteSummary[]  (the per-project list)
 *   - ['canvas', noteId]         → CanvasNote            (the full doc + scene)
 *
 * The list is kept newest-edited-first. The editor holds the scene locally (with
 * undo/redo) and autosaves through useSaveCanvas, which reconciles the saved row
 * back into both caches so list ordering + titles stay live. Heavy scene blobs
 * are kept out of the list payload (api.ts selects summary columns only).
 */

const listKey = (projectId: string): QueryKey => ['canvas-list', projectId];
const canvasKey = (noteId: string): QueryKey => ['canvas', noteId];

/** Project a full row down to a list summary (drops scene/doc_state). */
function toSummary(note: CanvasNote): CanvasNoteSummary {
  return {
    id: note.id,
    project_id: note.project_id,
    title: note.title,
    page_type: note.page_type,
    updated_by: note.updated_by,
    updated_at: note.updated_at,
    created_at: note.created_at,
  };
}

function sortByEdited<T extends { updated_at: string }>(rows: T[]): T[] {
  return [...rows].sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
  );
}

export function useCanvasList(projectId: string) {
  return useQuery({
    queryKey: listKey(projectId),
    queryFn: () => fetchCanvasList(projectId),
  });
}

export function useCanvas(noteId: string | undefined) {
  return useQuery({
    queryKey: canvasKey(noteId ?? ''),
    enabled: Boolean(noteId),
    queryFn: () => fetchCanvas(noteId as string),
  });
}

interface CreateContext {
  previous?: CanvasNoteSummary[];
}

/** Create a canvas; optimistically prepends a placeholder summary to the list. */
export function useCreateCanvas(projectId: string) {
  const queryClient = useQueryClient();
  const key = listKey(projectId);

  return useMutation<
    CanvasNote,
    Error,
    { title: string; pageType?: PageType; tempId: string },
    CreateContext
  >({
    mutationFn: ({ title, pageType }) => insertCanvas({ projectId, title, pageType }),
    onMutate: async ({ title, pageType, tempId }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<CanvasNoteSummary[]>(key);
      const now = new Date().toISOString();
      const optimistic: CanvasNoteSummary = {
        id: tempId,
        project_id: projectId,
        title: title.trim(),
        page_type: pageType ?? 'blank',
        updated_by: null,
        updated_at: now,
        created_at: now,
      };
      queryClient.setQueryData<CanvasNoteSummary[]>(key, (old) => [optimistic, ...(old ?? [])]);
      // Seed the editor cache with an empty doc so opening the new canvas while
      // the insert is still in flight shows the editor (not a refetch/404).
      queryClient.setQueryData<CanvasNote>(canvasKey(tempId), {
        ...optimistic,
        scene: {},
        doc_state: null,
      });
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },
    onSuccess: (created, { tempId }) => {
      queryClient.setQueryData<CanvasNoteSummary[]>(key, (old) =>
        (old ?? []).map((row) => (row.id === tempId ? toSummary(created) : row)),
      );
      // Drop the temp editor cache; seed the real one so it needs no refetch.
      queryClient.removeQueries({ queryKey: canvasKey(tempId) });
      queryClient.setQueryData(canvasKey(created.id), created);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: key });
    },
  });
}

interface DeleteContext {
  previous?: CanvasNoteSummary[];
}

export function useDeleteCanvas(projectId: string) {
  const queryClient = useQueryClient();
  const key = listKey(projectId);

  return useMutation<void, Error, { id: string }, DeleteContext>({
    mutationFn: ({ id }) => removeCanvas(id),
    onMutate: async ({ id }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<CanvasNoteSummary[]>(key);
      queryClient.setQueryData<CanvasNoteSummary[]>(key, (old) =>
        (old ?? []).filter((row) => row.id !== id),
      );
      queryClient.removeQueries({ queryKey: canvasKey(id) });
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: key });
    },
  });
}

/**
 * Autosave a canvas's title, page type and/or scene. Non-optimistic on the doc
 * (the editor already holds the live scene locally); on success it reconciles
 * the saved row into the editor cache and re-sorts the list summary. The DB
 * trigger owns updated_at/updated_by, so the returned row is canonical.
 */
export function useSaveCanvas(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation<
    CanvasNote,
    Error,
    { id: string; title?: string; page_type?: PageType; scene?: CanvasScene }
  >({
    mutationFn: ({ id, ...patch }) => patchCanvas(id, patch),
    onSuccess: (saved) => {
      queryClient.setQueryData(canvasKey(saved.id), saved);
      queryClient.setQueryData<CanvasNoteSummary[]>(listKey(projectId), (old) =>
        old ? sortByEdited(old.map((row) => (row.id === saved.id ? toSummary(saved) : row))) : old,
      );
    },
  });
}
