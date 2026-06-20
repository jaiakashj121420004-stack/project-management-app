import { useMemo, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { FileText, NotebookPen, Plus } from 'lucide-react';
import { cn } from '@/lib/cn';
import { GlassPanel } from '@/components/glass/GlassPanel';
import { GradientButton } from '@/components/buttons/GradientButton';
import { Spinner } from '@/components/feedback/Spinner';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import type { Note } from '@/types/database';
import { useAddNote, useNotes } from './useNotes';
import { NoteEditor } from './NoteEditor';

const DEFAULT_TITLE = 'Untitled note';

/** First non-empty line of the body, lightly stripped of markdown for a preview. */
function snippet(content: string): string {
  const line = content
    .split('\n')
    .map((l) => l.trim())
    .find(Boolean);
  if (!line) return '';
  return line
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1') // links → their text
    .replace(/[#>*_`~]+/g, '')
    .replace(/^[-+]\s+/, '')
    .trim();
}

/**
 * The per-project Notes tab: a list of notes on the left and the markdown editor
 * on the right (a single column on phones, where selecting a note swaps the list
 * for the editor). All access is membership-gated by RLS — this component never
 * filters by user. New/rename/delete + autosave run through useNotes.
 */
export function NotesPanel({ projectId }: { projectId: string }) {
  const { data, isLoading, isError } = useNotes(projectId);
  const addNote = useAddNote(projectId);
  const isDesktop = useMediaQuery('(min-width: 1024px)');

  const [selectedId, setSelectedId] = useState<string | null>(null);

  const notes = useMemo(
    () =>
      [...(data ?? [])].sort(
        (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
      ),
    [data],
  );

  // Derived selection (no effect): the explicit choice if it still exists, else
  // — on desktop only — the most-recent note. Phones stay on the list until a
  // note is tapped, and a deleted note falls back cleanly.
  const selected: Note | undefined =
    notes.find((note) => note.id === selectedId) ?? (isDesktop ? notes[0] : undefined);

  function handleCreate() {
    const tempId = crypto.randomUUID();
    setSelectedId(tempId);
    addNote.mutate(
      { title: DEFAULT_TITLE, tempId },
      { onSuccess: (row) => setSelectedId((current) => (current === tempId ? row.id : current)) },
    );
  }

  if (isLoading) {
    return (
      <div className="grid place-items-center py-24">
        <Spinner size={32} />
      </div>
    );
  }

  if (isError) {
    return (
      <GlassPanel className="p-6 text-center text-fg-muted">
        Couldn&apos;t load this project&apos;s notes. Check your connection and try again.
      </GlassPanel>
    );
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[18rem_minmax(0,1fr)]">
      <aside className={cn('flex-col gap-3', selected ? 'hidden lg:flex' : 'flex')}>
        <div className="flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-fg-muted">
            <NotebookPen size={15} /> Notes
            {notes.length > 0 && <span className="text-fg-subtle">· {notes.length}</span>}
          </h2>
          <GradientButton size="sm" leftIcon={<Plus size={15} />} onClick={handleCreate}>
            New
          </GradientButton>
        </div>

        {notes.length === 0 ? (
          <GlassPanel className="flex flex-col items-center gap-2 p-6 text-center">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[linear-gradient(135deg,var(--accent-from),var(--accent-to))] text-white">
              <FileText size={20} />
            </span>
            <p className="text-sm text-fg-muted">No notes yet. Capture a spec, a doc, or a brain-dump.</p>
          </GlassPanel>
        ) : (
          <ul className="flex flex-col gap-2">
            {notes.map((note) => (
              <li key={note.id}>
                <NoteListItem
                  note={note}
                  active={note.id === selected?.id}
                  onSelect={() => setSelectedId(note.id)}
                />
              </li>
            ))}
          </ul>
        )}
      </aside>

      <section className={cn('min-h-[60vh]', selected ? 'block' : 'hidden lg:block')}>
        {selected ? (
          <GlassPanel className="h-full p-5 sm:p-6">
            <NoteEditor
              key={selected.id}
              projectId={projectId}
              note={selected}
              onBack={() => setSelectedId(null)}
            />
          </GlassPanel>
        ) : (
          <GlassPanel className="grid h-full place-items-center p-10 text-center">
            <div className="flex flex-col items-center gap-3">
              <span className="grid h-14 w-14 place-items-center rounded-2xl bg-[linear-gradient(135deg,var(--accent-from),var(--accent-to))] text-white shadow-[0_12px_26px_-12px_var(--accent-glow)]">
                <NotebookPen size={26} />
              </span>
              <p className="max-w-xs text-fg-muted">
                Select a note to edit, or create one to start documenting this project.
              </p>
              <GradientButton leftIcon={<Plus size={16} />} onClick={handleCreate}>
                New note
              </GradientButton>
            </div>
          </GlassPanel>
        )}
      </section>
    </div>
  );
}

function NoteListItem({
  note,
  active,
  onSelect,
}: {
  note: Note;
  active: boolean;
  onSelect: () => void;
}) {
  const preview = snippet(note.content);
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={active}
      className={cn(
        'w-full rounded-2xl border p-3 text-left transition-colors',
        active
          ? 'border-[var(--accent-from)]/60 bg-[var(--glass-fill)] shadow-[0_10px_24px_-18px_var(--accent-glow)]'
          : 'border-[var(--glass-border)] hover:bg-[var(--glass-fill)]',
      )}
    >
      <p className="truncate text-sm font-semibold text-fg">{note.title}</p>
      <p className="mt-0.5 truncate text-xs text-fg-subtle">{preview || 'Empty note'}</p>
      <p className="mt-1 text-[0.7rem] text-fg-subtle">
        {formatDistanceToNow(new Date(note.updated_at), { addSuffix: true })}
      </p>
    </button>
  );
}
