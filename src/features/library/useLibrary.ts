import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import type { Folder, Note } from '@/types/database';
import {
  fetchStandaloneNotes,
  insertStandaloneNote,
  patchNote,
  removeNote,
} from '@/features/notes/api';
import {
  fetchFolders,
  insertFolder,
  moveFolder,
  removeFolder,
  renameFolder,
  setFolderIcon,
} from './api';
import { descendantIds } from './tree';

/**
 * The Library is backed by two owner-scoped caches:
 *   ['folders', userId]        → Folder[]  (the whole folder tree, flat)
 *   ['library-notes', userId]  → Note[]    (standalone notes, project_id null)
 * Personal canvases come from the canvas feature's ['canvas-all', userId] cache
 * (useAllCanvases / useMoveCanvasToFolder), so the Library never owns a second
 * copy of them. Every mutation patches its snapshot optimistically and rolls back
 * as a unit on error — the same strategy as notes/board.
 */

const foldersKey = (userId: string | undefined): QueryKey => ['folders', userId];
const libraryNotesKey = (userId: string | undefined): QueryKey => ['library-notes', userId];

// ── Folders ────────────────────────────────────────────────────────────────

export function useFolders() {
  const { user } = useAuth();
  return useQuery({
    queryKey: foldersKey(user?.id),
    enabled: Boolean(user?.id),
    queryFn: fetchFolders,
  });
}

interface FoldersContext {
  previous?: Folder[];
}

/** Shared optimistic plumbing for folder mutations. */
function useFoldersMutation<TData, TVariables>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  patch: (folders: Folder[], variables: TVariables) => Folder[],
  reconcile?: (folders: Folder[], result: TData, variables: TVariables) => Folder[],
  onSettledExtra?: () => void,
) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const key = foldersKey(user?.id);

  return useMutation<TData, Error, TVariables, FoldersContext>({
    mutationFn,
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Folder[]>(key);
      queryClient.setQueryData<Folder[]>(key, (old) => patch(old ?? [], variables));
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },
    onSuccess: (result, variables) => {
      if (reconcile) {
        queryClient.setQueryData<Folder[]>(key, (old) =>
          old ? reconcile(old, result, variables) : old,
        );
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: key });
      onSettledExtra?.();
    },
  });
}

export function useCreateFolder() {
  const { user } = useAuth();
  return useFoldersMutation<Folder, { name: string; parentId: string | null; tempId: string }>(
    ({ name, parentId }) => insertFolder({ name, parentId }),
    (folders, { name, parentId, tempId }) => {
      const now = new Date().toISOString();
      return [
        ...folders,
        {
          id: tempId,
          owner_id: user?.id ?? '',
          parent_id: parentId,
          name: name.trim(),
          icon: null,
          position: folders.length,
          created_at: now,
          updated_at: now,
        },
      ];
    },
    (folders, created, { tempId }) =>
      folders.map((folder) => (folder.id === tempId ? created : folder)),
  );
}

export function useRenameFolder() {
  return useFoldersMutation<Folder, { id: string; name: string }>(
    ({ id, name }) => renameFolder(id, name),
    (folders, { id, name }) =>
      folders.map((folder) => (folder.id === id ? { ...folder, name: name.trim() } : folder)),
    (folders, updated) => folders.map((f) => (f.id === updated.id ? updated : f)),
  );
}

/** Set or clear a folder's emoji icon. Optimistic, like rename. */
export function useSetFolderIcon() {
  return useFoldersMutation<Folder, { id: string; icon: string | null }>(
    ({ id, icon }) => setFolderIcon(id, icon),
    (folders, { id, icon }) =>
      folders.map((folder) => (folder.id === id ? { ...folder, icon } : folder)),
    (folders, updated) => folders.map((f) => (f.id === updated.id ? updated : f)),
  );
}

export function useMoveFolder() {
  return useFoldersMutation<Folder, { id: string; parentId: string | null }>(
    ({ id, parentId }) => moveFolder(id, parentId),
    (folders, { id, parentId }) =>
      folders.map((folder) => (folder.id === id ? { ...folder, parent_id: parentId } : folder)),
    (folders, updated) => folders.map((f) => (f.id === updated.id ? updated : f)),
  );
}

/**
 * Delete a folder and its whole subtree. Optimistically drops every descendant
 * from the folder cache; the DB nulls the folder_id of any contained notes /
 * canvases, so those item caches are invalidated to pick up the fall-to-root.
 */
export function useDeleteFolder() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useFoldersMutation<void, { id: string }>(
    ({ id }) => removeFolder(id),
    (folders, { id }) => {
      const doomed = descendantIds(folders, id);
      return folders.filter((folder) => !doomed.has(folder.id));
    },
    undefined,
    () => {
      void queryClient.invalidateQueries({ queryKey: libraryNotesKey(user?.id) });
      void queryClient.invalidateQueries({ queryKey: ['canvas-all', user?.id] });
    },
  );
}

// ── Standalone notes ─────────────────────────────────────────────────────────

export function useLibraryNotes() {
  const { user } = useAuth();
  return useQuery({
    queryKey: libraryNotesKey(user?.id),
    enabled: Boolean(user?.id),
    queryFn: fetchStandaloneNotes,
  });
}

interface NotesContext {
  previous?: Note[];
}

function useLibraryNotesMutation<TData, TVariables>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  patch: (notes: Note[], variables: TVariables) => Note[],
  reconcile?: (notes: Note[], result: TData, variables: TVariables) => Note[],
) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const key = libraryNotesKey(user?.id);

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
        queryClient.setQueryData<Note[]>(key, (old) => (old ? reconcile(old, result, variables) : old));
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: key });
    },
  });
}

export function useCreateLibraryNote() {
  const { user } = useAuth();
  return useLibraryNotesMutation<
    Note,
    { title: string; folderId: string | null; tempId: string }
  >(
    ({ title, folderId }) => insertStandaloneNote({ title, folderId }),
    (notes, { title, folderId, tempId }) => {
      const now = new Date().toISOString();
      return [
        {
          id: tempId,
          project_id: null,
          owner_id: user?.id ?? '',
          folder_id: folderId,
          title: title.trim(),
          icon: null,
          content: '',
          content_json: null,
          updated_at: now,
          created_at: now,
        },
        ...notes,
      ];
    },
    (notes, created, { tempId }) => notes.map((n) => (n.id === tempId ? created : n)),
  );
}

/** Autosave path for a standalone note (title/content); bumps updated_at locally
 *  so the list re-sorts immediately. Shape matches project notes' useUpdateNote. */
export function useUpdateLibraryNote() {
  return useLibraryNotesMutation<
    Note,
    {
      id: string;
      title?: string;
      icon?: string | null;
      content?: string;
      content_json?: Record<string, unknown> | null;
    }
  >(
    ({ id, ...rest }) => patchNote(id, rest),
    (notes, { id, title, icon, content, content_json }) =>
      notes.map((note) =>
        note.id === id
          ? {
              ...note,
              ...(title !== undefined ? { title: title.trim() } : {}),
              ...(icon !== undefined ? { icon } : {}),
              ...(content !== undefined ? { content } : {}),
              ...(content_json !== undefined ? { content_json } : {}),
              updated_at: new Date().toISOString(),
            }
          : note,
      ),
    (notes, updated) => notes.map((note) => (note.id === updated.id ? updated : note)),
  );
}

export function useDeleteLibraryNote() {
  return useLibraryNotesMutation<void, { id: string }>(
    ({ id }) => removeNote(id),
    (notes, { id }) => notes.filter((note) => note.id !== id),
  );
}

/** Move a standalone note into a folder (null = Library root). Optimistic. */
export function useMoveNoteToFolder() {
  return useLibraryNotesMutation<Note, { id: string; folderId: string | null }>(
    ({ id, folderId }) => patchNote(id, { folder_id: folderId }),
    (notes, { id, folderId }) =>
      notes.map((note) => (note.id === id ? { ...note, folder_id: folderId } : note)),
    (notes, updated) => notes.map((note) => (note.id === updated.id ? updated : note)),
  );
}
