import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { AlertCircle, Check, Eye, Pencil, Trash2 } from 'lucide-react';
import { Spinner } from '@/components/feedback/Spinner';
import { SegmentedToggle } from '@/components/forms/SegmentedToggle';
import type { Note } from '@/types/database';
import { noteTitleSchema } from './schemas';
import { useDeleteNote, useUpdateNote } from './useNotes';
import { Markdown } from './markdown';

interface NoteEditorProps {
  projectId: string;
  /** Keyed by id in the parent, so this remounts (re-seeds) when the note changes. */
  note: Note;
  /** Editors/owners can edit + delete; viewers get a read-only rendered view. */
  canEdit: boolean;
  /** Clear the parent's selection after a delete (falls back to the next note). */
  onDeleted: () => void;
}

type SaveStatus = 'saved' | 'unsaved' | 'saving' | 'error';

/** Debounced autosave: one write per ~700ms of idle, never on every keystroke. */
const AUTOSAVE_DELAY = 700;

interface Snapshot {
  title: string;
  content: string;
}

/** Build the patch for the changed fields, or null if nothing (valid) changed. */
function buildPatch(title: string, content: string, saved: Snapshot) {
  const parsed = noteTitleSchema.safeParse(title);
  if (!parsed.success) return null; // an empty title can't be persisted
  const titleChanged = parsed.data !== saved.title;
  const contentChanged = content !== saved.content;
  if (!titleChanged && !contentChanged) return null;
  return {
    ...(titleChanged ? { title: parsed.data } : {}),
    ...(contentChanged ? { content } : {}),
  };
}

/**
 * The note editor: an inline title, a full-width markdown pane with an
 * Edit/Preview toggle (single pane on every breakpoint — never side-by-side),
 * and a subtle save indicator. Edits autosave on a debounce and flush on
 * unmount, so switching notes never drops an in-flight change. Save status is
 * derived during render; only async outcomes touch state.
 */
export function NoteEditor({ projectId, note, canEdit, onDeleted }: NoteEditorProps) {
  // mutate is a stable reference in TanStack Query, so the debounce effect below
  // only re-runs on real edits — background re-renders can't reset the timer.
  const { mutate: runUpdate } = useUpdateNote(projectId);
  const { mutate: runDelete } = useDeleteNote(projectId);

  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const [saved, setSaved] = useState<Snapshot>({ title: note.title, content: note.content });
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'error'>('idle');
  const [mode, setMode] = useState<'edit' | 'preview'>('edit');
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  // Derived (no setState in render): validity + dirtiness + the shown status.
  const titleParse = noteTitleSchema.safeParse(title);
  const titleError = titleParse.success
    ? null
    : (titleParse.error.issues[0]?.message ?? 'Give the note a title.');
  const isDirty = content !== saved.content || title.trim() !== saved.title;
  const status: SaveStatus =
    saveState === 'saving' ? 'saving' : saveState === 'error' ? 'error' : isDirty ? 'unsaved' : 'saved';

  // Debounced autosave. setState only runs inside async callbacks, never
  // synchronously in the effect body.
  useEffect(() => {
    if (!canEdit) return;
    const patch = buildPatch(title, content, saved);
    if (!patch) return;
    const timer = setTimeout(() => {
      setSaveState('saving');
      runUpdate(
        { id: note.id, ...patch },
        {
          onSuccess: (row) => {
            setSaved({ title: row.title, content: row.content });
            setSaveState('idle');
          },
          onError: () => setSaveState('error'),
        },
      );
    }, AUTOSAVE_DELAY);
    return () => clearTimeout(timer);
  }, [title, content, saved, note.id, runUpdate, canEdit]);

  // Keep a flush closure current, then run it once on unmount so a change made
  // within the debounce window (e.g. quickly switching notes) is still saved.
  const flushRef = useRef<() => void>(() => {});
  useEffect(() => {
    flushRef.current = () => {
      if (!canEdit) return;
      const patch = buildPatch(title, content, saved);
      if (patch) runUpdate({ id: note.id, ...patch });
    };
  });
  useEffect(() => () => flushRef.current(), []);

  function handleDelete() {
    runDelete({ id: note.id });
    onDeleted();
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <input
            value={title}
            maxLength={120}
            readOnly={!canEdit}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setTitle(event.target.value)}
            placeholder="Note title…"
            aria-label="Note title"
            className="w-full truncate bg-transparent font-display text-xl font-bold text-fg placeholder:text-fg-subtle focus:outline-none sm:text-2xl"
          />
          {canEdit && titleError && <p className="mt-1 text-xs text-danger">{titleError}</p>}
        </div>

        {canEdit && (
          <div className="flex shrink-0 items-center gap-2">
            <SaveIndicator status={status} />
            <button
              type="button"
              aria-label="Delete note"
              onClick={() => setConfirmingDelete((open) => !open)}
              className="grid h-9 w-9 place-items-center rounded-xl text-fg-subtle transition-colors hover:bg-danger/10 hover:text-danger"
            >
              <Trash2 size={16} />
            </button>
          </div>
        )}
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

      {/* Edit / Preview toggle on every breakpoint — only the active pane shows,
          always full width. Viewers get a single rendered pane (no toggle). */}
      {canEdit && (
        <SegmentedToggle
          label="Editor mode"
          value={mode}
          onChange={setMode}
          options={[
            { value: 'edit', label: 'Edit', icon: <Pencil size={14} /> },
            { value: 'preview', label: 'Preview', icon: <Eye size={14} /> },
          ]}
        />
      )}

      {canEdit ? (
        <div className="flex min-h-0 flex-1 flex-col">
          {mode === 'edit' ? (
            <textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              placeholder="Write in markdown… **bold**, # headings, - lists, [links](https://…)"
              aria-label="Note content"
              spellCheck
              className="h-full min-h-[50vh] w-full flex-1 resize-none rounded-2xl border bg-[var(--field-bg)] p-4 font-mono text-sm leading-relaxed text-fg placeholder:text-fg-subtle focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--accent-from)]"
            />
          ) : (
            <div className="h-full min-h-[50vh] flex-1 overflow-y-auto rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-fill)] p-4">
              {content.trim() ? (
                <Markdown source={content} />
              ) : (
                <p className="text-sm text-fg-subtle">Nothing to preview yet.</p>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="min-h-[50vh] flex-1 overflow-y-auto rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-fill)] p-4 sm:p-6">
          {content.trim() ? (
            <Markdown source={content} />
          ) : (
            <p className="text-sm text-fg-subtle">This note is empty.</p>
          )}
        </div>
      )}
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
