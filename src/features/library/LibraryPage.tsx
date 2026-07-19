import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowLeft, Library as LibraryIcon, Search, X } from 'lucide-react';
import { GlassPanel } from '@/components/glass/GlassPanel';
import { Spinner } from '@/components/feedback/Spinner';
import { Reveal } from '@/components/motion/Reveal';
import { useIsPro } from '@/features/billing';
import { ShareButton } from '@/features/sharing';
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
  const [search, setSearch] = useState('');
  const [backNote, setBackNote] = useState<{ id: string; title: string } | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  // Deep-links (e.g. from the command palette or an Insert-canvas card):
  //   `/library?canvas=<id>` opens that canvas — `note`/`noteTitle` may ride
  //     along to offer a "back to note" link.
  //   `/library?note=<id>`   opens that standalone note.
  //   `/library?folder=<id>` drills into that folder.
  // Params are cleared after handling so refresh/back won't re-trigger.
  // This effect synchronises with an external system (the URL): it consumes a
  // one-shot navigation intent from the query string, then strips it. Setting
  // state directly here is the correct pattern, so the set-state-in-effect rule
  // is intentionally disabled for this block.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const canvasId = searchParams.get('canvas');
    const noteId = searchParams.get('note');
    const folderId = searchParams.get('folder');
    if (!canvasId && !noteId && !folderId) return;

    if (canvasId) {
      setOpen({ kind: 'canvas', id: canvasId });
      setBackNote(noteId ? { id: noteId, title: searchParams.get('noteTitle') ?? 'note' } : null);
    } else if (noteId) {
      setOpen({ kind: 'note', id: noteId });
    } else if (folderId) {
      setCurrentFolderId(folderId);
    }

    const next = new URLSearchParams(searchParams);
    next.delete('canvas');
    next.delete('note');
    next.delete('noteTitle');
    next.delete('folder');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);
  /* eslint-enable react-hooks/set-state-in-effect */

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
    setSearch('');
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
          <div className="flex items-center justify-between gap-2">
            {open.kind === 'canvas' &&
            backNote &&
            (notes.data ?? []).some((note) => note.id === backNote.id) ? (
              <button
                type="button"
                onClick={() => {
                  setOpen({ kind: 'note', id: backNote.id });
                  setBackNote(null);
                }}
                className="inline-flex w-fit items-center gap-1.5 rounded-lg px-2 py-1 text-sm text-fg-muted transition-colors hover:bg-[var(--glass-fill)] hover:text-fg"
              >
                <ArrowLeft size={16} /> Back to
                <span className="max-w-[12rem] truncate font-medium text-fg">{backNote.title}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setOpen(null)}
                className="inline-flex w-fit items-center gap-1.5 rounded-lg px-2 py-1 text-sm text-fg-muted transition-colors hover:bg-[var(--glass-fill)] hover:text-fg"
              >
                <ArrowLeft size={16} /> Library
                <span className="text-fg-subtle">· {openTitle}</span>
              </button>
            )}
            {open.kind === 'canvas' && (
              <ShareButton kind="canvas" targetId={open.id} title={openTitle} />
            )}
          </div>

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
        <div className="flex flex-col gap-4">
          <div className="relative max-w-md">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search your Library…"
              aria-label="Search the Library"
              className="w-full rounded-xl border border-[var(--glass-border)] bg-[var(--field-bg)] py-2.5 pl-9 pr-9 text-sm text-fg placeholder:text-fg-subtle focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--accent-from)]"
            />
            {search && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-md text-fg-subtle hover:bg-[var(--glass-fill)] hover:text-fg"
              >
                <X size={14} />
              </button>
            )}
          </div>

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
              search={search}
            />
          </div>
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
