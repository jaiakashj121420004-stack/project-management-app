import { useMemo, useState } from 'react';
import { NotebookPen, Plus } from 'lucide-react';
import { GlassPanel } from '@/components/glass/GlassPanel';
import { GradientButton } from '@/components/buttons/GradientButton';
import { Spinner } from '@/components/feedback/Spinner';
import { EntityPicker } from '@/components/forms/EntityPicker';
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
 * The per-project Notes tab: a full-width header (a glass dropdown picker for
 * the active note, the count, and a New button) over the selected note's editor
 * at full width on every breakpoint. The most-recently-edited note is selected
 * by default; deleting falls back to the next one. All access is membership-gated
 * by RLS — this component never filters by user.
 */
export function NotesPanel({ projectId, canEdit }: { projectId: string; canEdit: boolean }) {
  const { data, isLoading, isError } = useNotes(projectId);
  const addNote = useAddNote(projectId);

  const [selectedId, setSelectedId] = useState<string | null>(null);

  const notes = useMemo(
    () =>
      [...(data ?? [])].sort(
        (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
      ),
    [data],
  );

  // Derived selection (no effect): the explicit choice if it still exists, else
  // the most-recent note. A deleted note simply falls back to the next one.
  const selected: Note | undefined = notes.find((note) => note.id === selectedId) ?? notes[0];

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
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {notes.length > 0 && (
            <EntityPicker
              className="w-full max-w-[15rem] sm:max-w-[18rem]"
              label="Select a note"
              items={notes.map((note) => ({
                id: note.id,
                title: note.title,
                subtitle: snippet(note.content) || 'Empty note',
              }))}
              selectedId={selected?.id ?? null}
              onSelect={setSelectedId}
            />
          )}
          <span className="flex shrink-0 items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-fg-muted">
            <NotebookPen size={15} /> Notes
            <span className="text-fg-subtle">· {notes.length}</span>
          </span>
        </div>
        {canEdit && (
          <GradientButton size="sm" leftIcon={<Plus size={15} />} onClick={handleCreate}>
            New
          </GradientButton>
        )}
      </div>

      {notes.length === 0 ? (
        <GlassPanel className="grid min-h-[50vh] place-items-center p-10 text-center">
          <div className="flex flex-col items-center gap-3">
            <span className="grid h-14 w-14 place-items-center rounded-2xl bg-[linear-gradient(135deg,var(--accent-from),var(--accent-to))] text-[var(--accent-fg)] shadow-[0_12px_26px_-12px_var(--accent-glow)]">
              <NotebookPen size={26} />
            </span>
            <p className="max-w-xs text-fg-muted">
              {canEdit
                ? 'No notes yet. Capture a spec, a doc, or a brain-dump.'
                : 'No notes have been added to this project yet.'}
            </p>
            {canEdit && (
              <GradientButton leftIcon={<Plus size={16} />} onClick={handleCreate}>
                New note
              </GradientButton>
            )}
          </div>
        </GlassPanel>
      ) : selected ? (
        <GlassPanel className="flex min-h-[70vh] flex-col p-5 sm:p-6">
          <NoteEditor
            key={selected.id}
            projectId={projectId}
            note={selected}
            canEdit={canEdit}
            onDeleted={() => setSelectedId(null)}
          />
        </GlassPanel>
      ) : null}
    </div>
  );
}
