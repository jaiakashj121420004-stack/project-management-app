import { useMemo, useState, type ReactNode } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ChevronRight, FolderPlus, Home, Shapes, FileText } from 'lucide-react';
import { GlassPanel } from '@/components/glass/GlassPanel';
import { GradientButton } from '@/components/buttons/GradientButton';
import { Modal } from '@/components/Modal';
import { UpgradeModal } from '@/features/billing';
import { PAGE_LABELS } from '@/lib/canvasPages';
import type { CanvasNoteSummary } from '@/features/canvas/api';
import {
  useCreateIndependentCanvas,
  useDeleteCanvas,
  useMoveCanvasToFolder,
  useRenameCanvas,
} from '@/features/canvas/useCanvas';
import { noteTitleSchema } from '@/features/notes/schemas';
import type { Folder, Note } from '@/types/database';
import { folderNameSchema } from './schemas';
import { folderPath, descendantIds } from './tree';
import { itemLabel, type LibraryItem } from './types';
import { LibraryItemCard } from './LibraryItemCard';
import { NameDialog } from './NameDialog';
import { MoveToDialog } from './MoveToDialog';
import {
  useCreateLibraryNote,
  useDeleteFolder,
  useDeleteLibraryNote,
  useMoveFolder,
  useMoveNoteToFolder,
  useRenameFolder,
  useUpdateLibraryNote,
} from './useLibrary';

interface LibraryContentsProps {
  folders: Folder[];
  notes: Note[];
  canvases: CanvasNoteSummary[];
  currentFolderId: string | null;
  isPro: boolean;
  onNavigate: (folderId: string | null) => void;
  onOpenItem: (item: { kind: 'note' | 'canvas'; id: string }) => void;
  /** Open the shared "New folder" dialog (owned by LibraryPage). */
  onNewFolder: () => void;
}

type Dialog =
  | { type: 'rename'; item: LibraryItem }
  | { type: 'move'; item: LibraryItem }
  | { type: 'delete'; item: LibraryItem }
  | null;

function rel(iso: string): string {
  return formatDistanceToNow(new Date(iso), { addSuffix: true });
}

/**
 * The Library "folder contents" surface: breadcrumbs, a create toolbar, and a
 * grid of the current folder's subfolders + standalone notes + personal canvases.
 * On mobile this is the whole navigation (tap a folder to drill in); on desktop it
 * sits beside the folder tree. All rename/move/delete/create dialogs live here.
 */
export function LibraryContents({
  folders,
  notes,
  canvases,
  currentFolderId,
  isPro,
  onNavigate,
  onOpenItem,
  onNewFolder,
}: LibraryContentsProps) {
  const [dialog, setDialog] = useState<Dialog>(null);
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  const renameFolder = useRenameFolder();
  const moveFolder = useMoveFolder();
  const deleteFolder = useDeleteFolder();
  const createNote = useCreateLibraryNote();
  const renameNote = useUpdateLibraryNote();
  const moveNote = useMoveNoteToFolder();
  const deleteNote = useDeleteLibraryNote();
  const createCanvas = useCreateIndependentCanvas();
  const renameCanvas = useRenameCanvas();
  const moveCanvas = useMoveCanvasToFolder();
  const deleteCanvas = useDeleteCanvas(null);

  const crumbs = useMemo(() => folderPath(folders, currentFolderId), [folders, currentFolderId]);

  const items = useMemo<LibraryItem[]>(() => {
    const folderItems: LibraryItem[] = folders
      .filter((folder) => folder.parent_id === currentFolderId)
      .map((folder) => ({ kind: 'folder', id: folder.id, name: folder.name }));

    // Notes + canvases together, newest-edited first (folders always lead).
    const files: { updated: string; item: LibraryItem }[] = [
      ...notes
        .filter((note) => note.folder_id === currentFolderId)
        .map((note) => ({
          updated: note.updated_at,
          item: {
            kind: 'note' as const,
            id: note.id,
            title: note.title,
            subtitle: `Note · edited ${rel(note.updated_at)}`,
          },
        })),
      ...canvases
        .filter((canvas) => canvas.folder_id === currentFolderId)
        .map((canvas) => ({
          updated: canvas.updated_at,
          item: {
            kind: 'canvas' as const,
            id: canvas.id,
            title: canvas.title,
            subtitle: `${PAGE_LABELS[canvas.page_type]} canvas · edited ${rel(canvas.updated_at)}`,
          },
        })),
    ];

    files.sort((a, b) => new Date(b.updated).getTime() - new Date(a.updated).getTime());

    return [...folderItems, ...files.map((file) => file.item)];
  }, [folders, notes, canvases, currentFolderId]);

  function handleNewNote() {
    createNote.mutate(
      { title: 'Untitled note', folderId: currentFolderId, tempId: crypto.randomUUID() },
      { onSuccess: (row) => onOpenItem({ kind: 'note', id: row.id }) },
    );
  }

  function handleNewCanvas() {
    if (!isPro) {
      setUpgradeOpen(true);
      return;
    }
    createCanvas.mutate(
      { title: 'Untitled canvas', folderId: currentFolderId, tempId: crypto.randomUUID() },
      { onSuccess: (row) => onOpenItem({ kind: 'canvas', id: row.id }) },
    );
  }

  function submitRename(value: string) {
    if (dialog?.type !== 'rename') return;
    const { item } = dialog;
    if (item.kind === 'folder') {
      const parsed = folderNameSchema.safeParse(value);
      if (parsed.success) renameFolder.mutate({ id: item.id, name: parsed.data });
      return;
    }
    const parsed = noteTitleSchema.safeParse(value);
    if (!parsed.success) return;
    if (item.kind === 'note') renameNote.mutate({ id: item.id, title: parsed.data });
    else renameCanvas.mutate({ id: item.id, title: parsed.data });
  }

  function submitMove(folderId: string | null) {
    if (dialog?.type !== 'move') return;
    const { item } = dialog;
    if (item.kind === 'folder') moveFolder.mutate({ id: item.id, parentId: folderId });
    else if (item.kind === 'note') moveNote.mutate({ id: item.id, folderId });
    else moveCanvas.mutate({ id: item.id, folderId });
  }

  function confirmDelete() {
    if (dialog?.type !== 'delete') return;
    const { item } = dialog;
    if (item.kind === 'folder') deleteFolder.mutate({ id: item.id });
    else if (item.kind === 'note') deleteNote.mutate({ id: item.id });
    else deleteCanvas.mutate({ id: item.id });
    setDialog(null);
  }

  // The current item's folder (for the move picker's checkmark) + disabled targets.
  const moveItem = dialog?.type === 'move' ? dialog.item : null;
  const moveCurrentFolder =
    moveItem?.kind === 'folder'
      ? (folders.find((f) => f.id === moveItem.id)?.parent_id ?? null)
      : currentFolderId;
  const moveDisabled =
    moveItem?.kind === 'folder' ? descendantIds(folders, moveItem.id) : undefined;

  return (
    <div className="flex flex-col gap-4">
      {/* Breadcrumbs */}
      <div className="flex flex-wrap items-center gap-1 text-sm text-fg-muted">
        <button
          type="button"
          onClick={() => onNavigate(null)}
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 hover:bg-[var(--glass-fill)] hover:text-fg"
        >
          <Home size={15} /> Library
        </button>
        {crumbs.map((folder) => (
          <span key={folder.id} className="inline-flex items-center gap-1">
            <ChevronRight size={14} className="text-fg-subtle" />
            <button
              type="button"
              onClick={() => onNavigate(folder.id)}
              className="max-w-[10rem] truncate rounded-lg px-2 py-1 hover:bg-[var(--glass-fill)] hover:text-fg"
            >
              {folder.name}
            </button>
          </span>
        ))}
      </div>

      {/* Create toolbar */}
      <div className="flex flex-wrap gap-2">
        <GradientButton size="sm" leftIcon={<FolderPlus size={15} />} onClick={onNewFolder}>
          New folder
        </GradientButton>
        <GradientButton
          size="sm"
          variant="secondary"
          leftIcon={<FileText size={15} />}
          onClick={handleNewNote}
          isLoading={createNote.isPending}
        >
          New note
        </GradientButton>
        <GradientButton
          size="sm"
          variant="secondary"
          leftIcon={<Shapes size={15} />}
          onClick={handleNewCanvas}
          isLoading={createCanvas.isPending}
        >
          New canvas
        </GradientButton>
      </div>

      {/* Grid / empty state */}
      {items.length === 0 ? (
        <GlassPanel className="grid min-h-[45vh] place-items-center p-10 text-center">
          <div className="flex max-w-xs flex-col items-center gap-2">
            <span className="grid h-14 w-14 place-items-center rounded-2xl bg-[var(--accent-from)]/12 text-[var(--accent-from)]">
              <FolderPlus size={26} />
            </span>
            <p className="text-fg-muted">
              This folder is empty. Create a note, a canvas, or a subfolder to fill it.
            </p>
          </div>
        </GlassPanel>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <LibraryItemCard
              key={`${item.kind}:${item.id}`}
              item={item}
              canEdit
              onOpen={() =>
                item.kind === 'folder'
                  ? onNavigate(item.id)
                  : onOpenItem({ kind: item.kind, id: item.id })
              }
              onRename={() => setDialog({ type: 'rename', item })}
              onMove={() => setDialog({ type: 'move', item })}
              onDelete={() => setDialog({ type: 'delete', item })}
            />
          ))}
        </div>
      )}

      {/* Dialogs */}
      <NameDialog
        open={dialog?.type === 'rename'}
        title="Rename"
        initialValue={dialog?.type === 'rename' ? itemLabel(dialog.item) : ''}
        placeholder="Name…"
        confirmLabel="Rename"
        maxLength={dialog?.type === 'rename' && dialog.item.kind === 'folder' ? 80 : 120}
        onClose={() => setDialog(null)}
        onSubmit={submitRename}
      />
      <MoveToDialog
        open={dialog?.type === 'move'}
        folders={folders}
        currentFolderId={moveCurrentFolder}
        disabledIds={moveDisabled}
        onClose={() => setDialog(null)}
        onMove={submitMove}
      />
      <DeleteConfirm
        item={dialog?.type === 'delete' ? dialog.item : null}
        onCancel={() => setDialog(null)}
        onConfirm={confirmDelete}
      />
      <UpgradeModal
        open={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        reason="Upgrade to Pro to create infinite canvases in your Library."
      />
    </div>
  );
}

/** A small confirm modal reused for every delete. Folders warn about subfolders. */
function DeleteConfirm({
  item,
  onCancel,
  onConfirm,
}: {
  item: LibraryItem | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const label = item ? itemLabel(item) : '';
  const isFolder = item?.kind === 'folder';
  return (
    <NameConfirmModal open={Boolean(item)} onClose={onCancel}>
      <p className="text-sm text-fg-muted">
        Delete <span className="font-semibold text-fg">{label}</span>?
        {isFolder
          ? ' Its subfolders are deleted too; notes and canvases inside move back to the Library root.'
          : ' This can’t be undone.'}
      </p>
      <div className="mt-5 flex justify-end gap-2">
        <GradientButton type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </GradientButton>
        <button
          type="button"
          onClick={onConfirm}
          className="inline-flex h-11 items-center rounded-xl bg-danger px-5 text-[0.95rem] font-semibold text-[var(--accent-fg)] transition-transform duration-200 ease-spring hover:-translate-y-0.5 active:translate-y-0.5"
        >
          Delete
        </button>
      </div>
    </NameConfirmModal>
  );
}

/** Thin wrapper so DeleteConfirm can use the shared glass Modal without pulling in
 *  a form. Kept local to avoid another file for one tiny surface. */
function NameConfirmModal({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <Modal open={open} onClose={onClose} title="Delete" className="max-w-md">
      {children}
    </Modal>
  );
}
