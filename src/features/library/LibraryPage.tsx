import { useMemo, useState } from 'react';
import { ArrowLeft, Library as LibraryIcon } from 'lucide-react';
import { GlassPanel } from '@/components/glass/GlassPanel';
import { Spinner } from '@/components/feedback/Spinner';
import { Reveal } from '@/components/motion/Reveal';
import { useIsPro } from '@/features/billing';
import { useAllCanvases } from '@/features/canvas/useCanvas';
import { FolderTree } from './FolderTree';
import { LibraryContents } from './LibraryContents';
import { NameDialog } from './NameDialog';
import { OpenNote } from './OpenNote';
import { OpenCanvas } from './OpenCanvas';
import { folderNameSchema } from './schemas';
import { useCreateFolder, useFolders, useLibraryNotes } from './useLibrary';

type OpenItem = { kind: 'note' | 'canvas'; id: string } | null;

/**
 * The unified Library — a file explorer over the user's folders, standalone
 * notes, and personal canvases (NVEXIS-UPGRADE-PLAN §4). Desktop shows a folder
 * tree beside the contents; mobile is a tap-to-drill-in contents view. Opening a
 * note/canvas swaps to the full editor with a back bar. Konva stays lazy (the
 * canvas editor loads only when a canvas is opened).
 */
export function LibraryPage() {
  const folders = useFolders();
  const notes = useLibraryNotes();
  const canvases = useAllCanvases();
  const isPro = useIsPro();
  const createFolder = useCreateFolder();

  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [open, setOpen] = useState<OpenItem>(null);
  const [newFolderOpen, setNewFolderOpen] = useState(false);

  // Personal canvases only (project canvases live in their project's Canvas tab).
  const personalCanvases = useMemo(
    () => (canvases.data ?? []).filter((canvas) => canvas.project_id === null),
    [canvases.data],
  );

  const openNote =
    open?.kind === 'note' ? (notes.data ?? []).find((note) => note.id === open.id) : undefined;

  const openTitle =
    open?.kind === 'note'
      ? (openNote?.title ?? 'Note')
      : open?.kind === 'canvas'
        ? (personalCanvases.find((canvas) => canvas.id === open.id)?.title ?? 'Canvas')
        : '';

  const isLoading = folders.isLoading || notes.isLoading || canvases.isLoading;
  const isError = folders.isError || notes.isError;

  function navigate(folderId: string | null) {
    setCurrentFolderId(folderId);
  }

  return (
    <div className="flex flex-col gap-6">
      <Reveal>
        <header className="flex items-center gap-3 pt-2">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[linear-gradient(135deg,var(--accent-from),var(--accent-to))] text-[var(--accent-fg)] shadow-[0_10px_24px_-12px_var(--accent-glow)]">
            <LibraryIcon size={22} />
          </span>
          <div>
            <h1 className="gradient-text text-2xl font-bold leading-tight">Library</h1>
            <p className="text-sm text-fg-muted">Your notes and canvases, organised in folders.</p>
          </div>
        </header>
      </Reveal>

      {isLoading ? (
        <div className="grid place-items-center py-24">
          <Spinner size={32} />
        </div>
      ) : isError ? (
        <GlassPanel className="p-6 text-center text-fg-muted">
          Couldn&apos;t load your Library. Check your connection and try again.
        </GlassPanel>
      ) : open ? (
        <div className="flex flex-col gap-4">
          <button
            type="button"
            onClick={() => setOpen(null)}
            className="inline-flex w-fit items-center gap-1.5 rounded-lg px-2 py-1 text-sm text-fg-muted transition-colors hover:bg-[var(--glass-fill)] hover:text-fg"
          >
            <ArrowLeft size={16} /> Library
            <span className="text-fg-subtle">· {openTitle}</span>
          </button>

          {open.kind === 'note' ? (
            openNote ? (
              <OpenNote note={openNote} onBack={() => setOpen(null)} />
            ) : (
              <GlassPanel className="p-6 text-center text-fg-muted">
                This note is no longer available.
              </GlassPanel>
            )
          ) : (
            <OpenCanvas canvasId={open.id} canEdit={isPro} onBack={() => setOpen(null)} />
          )}
        </div>
      ) : (
        <div className="md:grid md:grid-cols-[16rem_1fr] md:gap-6">
          {/* Folder tree — desktop only; mobile navigates via the contents view. */}
          <aside className="hidden md:block">
            <GlassPanel className="sticky top-4 p-3">
              <FolderTree
                folders={folders.data ?? []}
                currentFolderId={currentFolderId}
                onSelect={navigate}
                onNewFolder={() => setNewFolderOpen(true)}
                canEdit
              />
            </GlassPanel>
          </aside>

          <div className="mt-4 md:mt-0">
            <LibraryContents
              folders={folders.data ?? []}
              notes={notes.data ?? []}
              canvases={personalCanvases}
              currentFolderId={currentFolderId}
              isPro={isPro}
              onNavigate={navigate}
              onOpenItem={setOpen}
              onNewFolder={() => setNewFolderOpen(true)}
            />
          </div>
        </div>
      )}

      <NameDialog
        open={newFolderOpen}
        title="New folder"
        placeholder="Folder name…"
        confirmLabel="Create"
        onClose={() => setNewFolderOpen(false)}
        onSubmit={(name) => {
          const parsed = folderNameSchema.safeParse(name);
          if (!parsed.success) return;
          createFolder.mutate({
            name: parsed.data,
            parentId: currentFolderId,
            tempId: crypto.randomUUID(),
          });
        }}
      />
    </div>
  );
}
