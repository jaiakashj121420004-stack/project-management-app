import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useProjects } from '@/features/projects/useProjects';
import type { CanvasNote } from '@/types/database';
import type { PageType } from '@/lib/canvasPages';
import type { CanvasScene } from './elements';
import {
  fetchAllCanvases,
  fetchCanvas,
  fetchCanvasList,
  insertCanvas,
  insertIndependentCanvas,
  patchCanvas,
  removeCanvas,
  type CanvasNoteSummary,
} from './api';

/**
 * Three caches back the canvas feature:
 *   - ['canvas-list', projectId] → CanvasNoteSummary[]  (one project's canvases)
 *   - ['canvas-all', userId]     → CanvasNoteSummary[]  (every canvas I can reach,
 *                                                        for the /canvas workspace)
 *   - ['canvas', noteId]         → CanvasNote           (the full doc + scene)
 *
 * A canvas may belong to a project OR be personal (project_id null). Project
 * canvases live in BOTH the per-project list and the aggregated list; personal
 * canvases only in the aggregated one. Save/delete reconcile whichever caches are
 * present, so both the project tab and the /canvas page stay live. Heavy scene
 * blobs are kept out of the list payloads (api.ts selects summary columns only).
 */

const listKey = (projectId: string): QueryKey => ['canvas-list', projectId];
const allKey = (userId: string | undefined): QueryKey => ['canvas-all', userId];
const canvasKey = (noteId: string): QueryKey => ['canvas', noteId];

/** Project a full row down to a list summary (drops scene/doc_state). */
function toSummary(note: CanvasNote): CanvasNoteSummary {
  return {
    id: note.id,
    project_id: note.project_id,
    owner_id: note.owner_id,
    folder_id: note.folder_id,
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

/** Patch a saved row into a summary list (re-sorting), or return it unchanged. */
function reconcileList(
  old: CanvasNoteSummary[] | undefined,
  saved: CanvasNote,
): CanvasNoteSummary[] | undefined {
  if (!old) return old;
  return sortByEdited(old.map((row) => (row.id === saved.id ? toSummary(saved) : row)));
}

export function useCanvasList(projectId: string) {
  return useQuery({
    queryKey: listKey(projectId),
    queryFn: () => fetchCanvasList(projectId),
  });
}

/** An aggregated canvas with its display group: the owning project's name, or
 *  null for a personal canvas (the component renders that as "Personal"). */
export interface AggregatedCanvas extends CanvasNoteSummary {
  projectName: string | null;
}

/**
 * Every canvas the signed-in user can access (RLS-scoped), labelled with its
 * project name (or null = personal) from the projects cache. Backs the top-level
 * /canvas workspace picker. Combines the raw aggregated list with the user's
 * projects so it never has to embed the project join in the query.
 */
export function useAllCanvases() {
  const { user } = useAuth();
  const projects = useProjects();
  const canvases = useQuery({
    queryKey: allKey(user?.id),
    enabled: Boolean(user?.id),
    queryFn: fetchAllCanvases,
  });

  const data = useMemo<AggregatedCanvas[] | undefined>(() => {
    if (!canvases.data) return undefined;
    const names = new Map((projects.data ?? []).map((project) => [project.id, project.name]));
    return canvases.data.map((canvas) => ({
      ...canvas,
      projectName: canvas.project_id ? (names.get(canvas.project_id) ?? null) : null,
    }));
  }, [canvases.data, projects.data]);

  return { data, isLoading: canvases.isLoading, isError: canvases.isError };
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

/** Build the optimistic summary a just-created canvas shows before it resolves. */
function optimisticSummary(input: {
  id: string;
  projectId: string | null;
  ownerId: string;
  title: string;
  pageType?: PageType;
  folderId?: string | null;
}): CanvasNoteSummary {
  const now = new Date().toISOString();
  return {
    id: input.id,
    project_id: input.projectId,
    owner_id: input.ownerId,
    folder_id: input.folderId ?? null,
    title: input.title.trim(),
    page_type: input.pageType ?? 'blank',
    updated_by: null,
    updated_at: now,
    created_at: now,
  };
}

/** Seed the editor cache with an empty doc so opening a brand-new canvas while
 *  its insert is still in flight shows the editor (not a refetch/404). */
function seedEditorCache(
  queryClient: ReturnType<typeof useQueryClient>,
  summary: CanvasNoteSummary,
): void {
  queryClient.setQueryData<CanvasNote>(canvasKey(summary.id), { ...summary, scene: {}, doc_state: null });
}

/** Create a canvas inside a project; optimistically prepends to the project list. */
export function useCreateCanvas(projectId: string) {
  const { user } = useAuth();
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
      const optimistic = optimisticSummary({
        id: tempId,
        projectId,
        ownerId: user?.id ?? '',
        title,
        pageType,
      });
      queryClient.setQueryData<CanvasNoteSummary[]>(key, (old) => [optimistic, ...(old ?? [])]);
      seedEditorCache(queryClient, optimistic);
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },
    onSuccess: (created, { tempId }) => {
      queryClient.setQueryData<CanvasNoteSummary[]>(key, (old) =>
        (old ?? []).map((row) => (row.id === tempId ? toSummary(created) : row)),
      );
      queryClient.removeQueries({ queryKey: canvasKey(tempId) });
      queryClient.setQueryData(canvasKey(created.id), created);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: key });
    },
  });
}

/** Create a PERSONAL canvas (no project); optimistically prepends to the
 *  aggregated /canvas list. Requires the caller to be on Pro (UI + RLS). */
export function useCreateIndependentCanvas() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const key = allKey(user?.id);

  return useMutation<
    CanvasNote,
    Error,
    { title: string; pageType?: PageType; tempId: string; folderId?: string | null },
    CreateContext
  >({
    mutationFn: ({ title, pageType, folderId }) =>
      insertIndependentCanvas({ title, pageType, folderId }),
    onMutate: async ({ title, pageType, tempId, folderId }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<CanvasNoteSummary[]>(key);
      const optimistic = optimisticSummary({
        id: tempId,
        projectId: null,
        ownerId: user?.id ?? '',
        title,
        pageType,
        folderId,
      });
      queryClient.setQueryData<CanvasNoteSummary[]>(key, (old) => [optimistic, ...(old ?? [])]);
      seedEditorCache(queryClient, optimistic);
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },
    onSuccess: (created, { tempId }) => {
      queryClient.setQueryData<CanvasNoteSummary[]>(key, (old) =>
        (old ?? []).map((row) => (row.id === tempId ? toSummary(created) : row)),
      );
      queryClient.removeQueries({ queryKey: canvasKey(tempId) });
      queryClient.setQueryData(canvasKey(created.id), created);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: key });
    },
  });
}

interface DeleteContext {
  previousList?: CanvasNoteSummary[];
  previousAll?: CanvasNoteSummary[];
}

/**
 * Delete a canvas. `projectId` is the canvas's project (null for a personal
 * canvas); it tells us which per-project list to patch. The aggregated list and
 * the editor cache are always cleaned up too.
 */
export function useDeleteCanvas(projectId: string | null) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const projectListKey = projectId ? listKey(projectId) : null;
  const aggregateKey = allKey(user?.id);

  return useMutation<void, Error, { id: string }, DeleteContext>({
    mutationFn: ({ id }) => removeCanvas(id),
    onMutate: async ({ id }) => {
      const remove = (old: CanvasNoteSummary[] | undefined) =>
        old ? old.filter((row) => row.id !== id) : old;

      let previousList: CanvasNoteSummary[] | undefined;
      if (projectListKey) {
        await queryClient.cancelQueries({ queryKey: projectListKey });
        previousList = queryClient.getQueryData<CanvasNoteSummary[]>(projectListKey);
        queryClient.setQueryData<CanvasNoteSummary[]>(projectListKey, remove);
      }
      await queryClient.cancelQueries({ queryKey: aggregateKey });
      const previousAll = queryClient.getQueryData<CanvasNoteSummary[]>(aggregateKey);
      queryClient.setQueryData<CanvasNoteSummary[]>(aggregateKey, remove);

      queryClient.removeQueries({ queryKey: canvasKey(id) });
      return { previousList, previousAll };
    },
    onError: (_error, _variables, context) => {
      if (projectListKey && context?.previousList) {
        queryClient.setQueryData(projectListKey, context.previousList);
      }
      if (context?.previousAll) queryClient.setQueryData(aggregateKey, context.previousAll);
    },
    onSettled: () => {
      if (projectListKey) void queryClient.invalidateQueries({ queryKey: projectListKey });
      void queryClient.invalidateQueries({ queryKey: aggregateKey });
    },
  });
}

interface MoveContext {
  previous?: CanvasNoteSummary[];
}

/**
 * Move a personal canvas into a Library folder (or to the root, folderId null).
 * Optimistically patches the aggregated ['canvas-all', userId] cache that the
 * Library reads. Project canvases are never moved from here (they aren't in the
 * Library), so only the aggregated cache is touched.
 */
export function useMoveCanvasToFolder() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const key = allKey(user?.id);

  return useMutation<CanvasNote, Error, { id: string; folderId: string | null }, MoveContext>({
    mutationFn: ({ id, folderId }) => patchCanvas(id, { folder_id: folderId }),
    onMutate: async ({ id, folderId }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<CanvasNoteSummary[]>(key);
      queryClient.setQueryData<CanvasNoteSummary[]>(key, (old) =>
        old ? old.map((row) => (row.id === id ? { ...row, folder_id: folderId } : row)) : old,
      );
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },
    onSuccess: (saved) => {
      queryClient.setQueryData<CanvasNoteSummary[]>(key, (old) => reconcileList(old, saved));
      queryClient.setQueryData(canvasKey(saved.id), saved);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: key });
    },
  });
}

/**
 * Rename a canvas from the Library (optimistic title on the aggregated cache).
 * Kept separate from useSaveCanvas so the Library needn't know a canvas's project.
 */
export function useRenameCanvas() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const key = allKey(user?.id);

  return useMutation<CanvasNote, Error, { id: string; title: string }, MoveContext>({
    mutationFn: ({ id, title }) => patchCanvas(id, { title }),
    onMutate: async ({ id, title }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<CanvasNoteSummary[]>(key);
      queryClient.setQueryData<CanvasNoteSummary[]>(key, (old) =>
        old ? old.map((row) => (row.id === id ? { ...row, title: title.trim() } : row)) : old,
      );
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },
    onSuccess: (saved) => {
      queryClient.setQueryData<CanvasNoteSummary[]>(key, (old) => reconcileList(old, saved));
      queryClient.setQueryData(canvasKey(saved.id), saved);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: key });
    },
  });
}

/**
 * Autosave a canvas's title, page type and/or scene. Non-optimistic on the doc
 * (the editor already holds the live scene locally); on success it reconciles the
 * saved row into the editor cache and into every list it appears in (the project
 * list if it's a project canvas, plus the aggregated list). The DB trigger owns
 * updated_at/updated_by, so the returned row is canonical.
 */
export function useSaveCanvas(projectId: string | null) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation<
    CanvasNote,
    Error,
    { id: string; title?: string; page_type?: PageType; scene?: CanvasScene; doc_state?: string }
  >({
    mutationFn: ({ id, ...patch }) => patchCanvas(id, patch),
    onSuccess: (saved) => {
      queryClient.setQueryData(canvasKey(saved.id), saved);
      if (projectId) {
        queryClient.setQueryData<CanvasNoteSummary[]>(listKey(projectId), (old) =>
          reconcileList(old, saved),
        );
      }
      queryClient.setQueryData<CanvasNoteSummary[]>(allKey(user?.id), (old) =>
        reconcileList(old, saved),
      );
    },
  });
}
