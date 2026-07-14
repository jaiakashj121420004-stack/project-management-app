import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
} from 'react';
import { AlertCircle, Check, Download, ImagePlus, Trash2 } from 'lucide-react';
import type { JSONContent } from '@tiptap/core';
import { Spinner } from '@/components/feedback/Spinner';
import { RouteErrorBoundary } from '@/components/feedback/RouteErrorBoundary';
import { useAuth } from '@/hooks/useAuth';
import { ShareButton } from '@/features/sharing';
import { EmojiPicker } from '@/components/forms/EmojiPicker';
import { docToMarkdown } from '@/features/editor/serialize';
import type { Note } from '@/types/database';
import { uploadNoteImage, useNoteMediaUrl } from './noteMedia';
import { noteTitleSchema } from './schemas';

// The Tiptap block editor (+ markdown converter) is code-split — it loads only
// when a note is actually opened, so the notes routes stay light.
const NoteBlockEditor = lazy(() => import('./NoteBlockEditor'));

/** Autosave patch handler. Assignable from TanStack's `mutate`, so the same
 *  editor drives project notes AND standalone Library notes. */
export type UpdateNoteFn = (
  variables: {
    id: string;
    title?: string;
    icon?: string | null;
    cover?: string | null;
    content?: string;
    content_json?: Record<string, unknown> | null;
  },
  options?: { onSuccess?: (row: Note) => void; onError?: () => void },
) => void;
export type DeleteNoteFn = (variables: { id: string }) => void;

interface NoteEditorProps {
  /** Keyed by id in the parent, so this remounts (re-seeds) when the note changes. */
  note: Note;
  /** Editors/owners can edit + delete; viewers get a read-only rendered view. */
  canEdit: boolean;
  /** Clear the parent's selection after a delete (falls back to the next note). */
  onDeleted: () => void;
  /** Scoped autosave mutation (project- or library-keyed cache). */
  runUpdate: UpdateNoteFn;
  /** Scoped delete mutation. */
  runDelete: DeleteNoteFn;
}

type SaveStatus = 'saved' | 'unsaved' | 'saving' | 'error';

/** Debounced autosave: one write per ~700ms of idle, never on every keystroke. */
const AUTOSAVE_DELAY = 700;

/**
 * The note editor: an inline title, the shared Notion-style block editor, and a
 * subtle save indicator. Title and document edits autosave on a debounce and
 * flush on unmount, so switching notes never drops an in-flight change. The block
 * document is the source of truth (content_json); a plain-text mirror is saved
 * alongside for previews + search. Save status is derived during render.
 */
export function NoteEditor({ note, canEdit, onDeleted, runUpdate, runDelete }: NoteEditorProps) {
  const { user } = useAuth();
  // A standalone note the current user owns can be shared with other users.
  const canShare = note.project_id === null && note.owner_id === user?.id;

  const [title, setTitle] = useState(note.title);
  const [savedTitle, setSavedTitle] = useState(note.title);
  const [docDirty, setDocDirty] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'error'>('idle');
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  // Emoji icon + cover image (standalone Library notes only). Written immediately.
  const [icon, setIcon] = useState<string | null>(note.icon ?? null);
  const [cover, setCover] = useState<string | null>(note.cover ?? null);
  const [coverUploading, setCoverUploading] = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const { url: coverUrl } = useNoteMediaUrl(cover);
  const isStandalone = note.project_id === null;

  // Latest document from the editor (only present once the user edits).
  const docRef = useRef<{ json: JSONContent; text: string } | null>(null);

  const titleParse = noteTitleSchema.safeParse(title);
  const titleError = titleParse.success
    ? null
    : (titleParse.error.issues[0]?.message ?? 'Give the note a title.');
  const titleDirty = titleParse.success && titleParse.data !== savedTitle;
  const isDirty = titleDirty || docDirty;
  const status: SaveStatus =
    saveState === 'saving' ? 'saving' : saveState === 'error' ? 'error' : isDirty ? 'unsaved' : 'saved';

  const handleDocChange = useCallback((json: JSONContent, text: string) => {
    docRef.current = { json, text };
    setDocDirty(true);
  }, []);

  // Build the patch for whatever changed, or null if nothing (valid) has.
  const buildPatch = useCallback(() => {
    const patch: {
      id: string;
      title?: string;
      content?: string;
      content_json?: Record<string, unknown>;
    } = { id: note.id };
    if (titleParse.success && titleParse.data !== savedTitle) patch.title = titleParse.data;
    if (docDirty && docRef.current) {
      patch.content_json = docRef.current.json as Record<string, unknown>;
      patch.content = docRef.current.text;
    }
    return patch.title === undefined && patch.content_json === undefined ? null : patch;
  }, [note.id, titleParse, savedTitle, docDirty]);

  // Debounced autosave. setState only runs inside async callbacks.
  useEffect(() => {
    if (!canEdit || !isDirty) return;
    const timer = setTimeout(() => {
      const patch = buildPatch();
      if (!patch) return;
      setSaveState('saving');
      runUpdate(patch, {
        onSuccess: (row) => {
          setSavedTitle(row.title);
          setDocDirty(false);
          setSaveState('idle');
        },
        onError: () => setSaveState('error'),
      });
    }, AUTOSAVE_DELAY);
    return () => clearTimeout(timer);
  }, [canEdit, isDirty, buildPatch, runUpdate]);

  // Flush any pending change once on unmount (e.g. quickly switching notes).
  const flushRef = useRef<() => void>(() => {});
  useEffect(() => {
    flushRef.current = () => {
      if (!canEdit) return;
      const patch = buildPatch();
      if (patch) runUpdate(patch);
    };
  });
  useEffect(() => () => flushRef.current(), []);

  function handleDelete() {
    runDelete({ id: note.id });
    onDeleted();
  }

  function handleIconSelect(next: string | null) {
    setIcon(next);
    runUpdate({ id: note.id, icon: next });
  }

  async function uploadCover(file: File) {
    setCoverUploading(true);
    try {
      const { path } = await uploadNoteImage(note.id, file);
      setCover(path);
      runUpdate({ id: note.id, cover: path });
    } catch {
      // Leave the banner unchanged on failure — not worth an intrusive error here.
    } finally {
      setCoverUploading(false);
    }
  }

  function removeCover() {
    setCover(null);
    runUpdate({ id: note.id, cover: null });
  }

  // Export the current document (including unsaved edits) as a .md download.
  function handleExport() {
    const doc = docRef.current?.json ?? (note.content_json as JSONContent | null);
    const cleanTitle = title.trim() || 'Untitled note';
    const markdown = `# ${cleanTitle}\n\n${docToMarkdown(doc as Record<string, unknown> | null)}`;
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${cleanTitle.replace(/[^\w\- ]+/g, '').trim() || 'note'}.md`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      {isStandalone && (cover || canEdit) && (
        <div className="group relative -mt-1 h-32 overflow-hidden rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-fill)] sm:h-44">
          {cover ? (
            coverUrl ? (
              <img src={coverUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="grid h-full w-full place-items-center text-xs text-fg-subtle">Loading cover…</div>
            )
          ) : (
            <button
              type="button"
              onClick={() => coverInputRef.current?.click()}
              className="flex h-full w-full flex-col items-center justify-center gap-1 text-fg-subtle transition-colors hover:text-fg"
            >
              <ImagePlus size={20} />
              <span className="text-xs font-medium">Add cover</span>
            </button>
          )}
          {canEdit && cover && (
            <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
              <button
                type="button"
                onClick={() => coverInputRef.current?.click()}
                className="glass-strong rounded-lg border border-[var(--glass-border)] px-2 py-1 text-xs font-medium text-fg-muted hover:text-fg"
              >
                Change
              </button>
              <button
                type="button"
                onClick={removeCover}
                className="glass-strong rounded-lg border border-[var(--glass-border)] px-2 py-1 text-xs font-medium text-fg-muted hover:text-danger"
              >
                Remove
              </button>
            </div>
          )}
          {coverUploading && (
            <div className="absolute inset-0 grid place-items-center bg-black/25">
              <Spinner size={22} />
            </div>
          )}
        </div>
      )}
      {isStandalone && canEdit && (
        <input
          ref={coverInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void uploadCover(file);
            event.target.value = '';
          }}
        />
      )}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {isStandalone && canEdit ? (
              <EmojiPicker
                value={icon}
                onSelect={handleIconSelect}
                ariaLabel="Set note icon"
                buttonClassName="h-9 w-9 shrink-0"
                iconSize={22}
              />
            ) : (
              icon && (
                <span className="grid h-9 w-9 shrink-0 place-items-center text-2xl leading-none">{icon}</span>
              )
            )}
            <input
              value={title}
              maxLength={120}
              readOnly={!canEdit}
              onChange={(event: ChangeEvent<HTMLInputElement>) => setTitle(event.target.value)}
              placeholder="Note title…"
              aria-label="Note title"
              className="min-w-0 flex-1 truncate bg-transparent font-display text-xl font-bold text-fg placeholder:text-fg-subtle focus:outline-none sm:text-2xl"
            />
          </div>
          {canEdit && titleError && <p className="mt-1 text-xs text-danger">{titleError}</p>}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            aria-label="Export as Markdown"
            title="Export as Markdown"
            onClick={handleExport}
            className="grid h-9 w-9 place-items-center rounded-xl text-fg-subtle transition-colors hover:bg-[var(--glass-fill)] hover:text-fg"
          >
            <Download size={16} />
          </button>
          {canEdit && (
            <>
              {canShare && (
                <ShareButton kind="note" targetId={note.id} title={note.title} className="hidden sm:inline-flex" />
              )}
              <SaveIndicator status={status} />
              <button
                type="button"
                aria-label="Delete note"
                onClick={() => setConfirmingDelete((open) => !open)}
                className="grid h-9 w-9 place-items-center rounded-xl text-fg-subtle transition-colors hover:bg-danger/10 hover:text-danger"
              >
                <Trash2 size={16} />
              </button>
            </>
          )}
        </div>
      </div>

      {confirmingDelete && canEdit && (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-fg-muted">
          <span>
            Delete <span className="font-semibold text-fg">{note.title}</span>? This can&apos;t be
            undone.
          </span>
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() => setConfirmingDelete(false)}
              className="rounded-lg px-2 py-1 text-xs font-medium text-fg-muted hover:bg-[var(--glass-fill)]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDelete}
              className="rounded-lg bg-danger/20 px-2 py-1 text-xs font-semibold text-danger hover:bg-danger/30"
            >
              Delete
            </button>
          </div>
        </div>
      )}

      <RouteErrorBoundary key={note.id} label="the note editor" resetKeys={[note.id]}>
        <Suspense
          fallback={
            <div className="grid min-h-[40vh] place-items-center">
              <Spinner size={28} />
            </div>
          }
        >
          <NoteBlockEditor note={note} editable={canEdit} onChange={handleDocChange} />
        </Suspense>
      </RouteErrorBoundary>
    </div>
  );
}

/** A subtle, non-shouting indicator of the autosave state. */
function SaveIndicator({ status }: { status: SaveStatus }) {
  if (status === 'saving') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-fg-subtle">
        <Spinner size={12} className="text-current" /> Saving…
      </span>
    );
  }
  if (status === 'unsaved') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-fg-subtle">
        <span className="h-1.5 w-1.5 rounded-full bg-warning" /> Unsaved
      </span>
    );
  }
  if (status === 'error') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-danger">
        <AlertCircle size={13} /> Couldn&apos;t save
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-fg-subtle">
      <Check size={13} className="text-success" /> Saved
    </span>
  );
}
