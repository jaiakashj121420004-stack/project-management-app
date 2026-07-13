import { GlassPanel } from '@/components/glass/GlassPanel';
import { NoteEditor } from '@/features/notes/NoteEditor';
import type { Note } from '@/types/database';
import { useDeleteLibraryNote, useUpdateLibraryNote } from './useLibrary';

/** Opens a standalone Library note in the shared NoteEditor, wired to the
 *  library-scoped autosave + delete mutations. Deleting returns to the browser. */
export function OpenNote({ note, onBack }: { note: Note; onBack: () => void }) {
  const update = useUpdateLibraryNote();
  const del = useDeleteLibraryNote();

  return (
    <GlassPanel className="flex min-h-[70vh] flex-col p-5 sm:p-6">
      <NoteEditor
        key={note.id}
        note={note}
        canEdit
        onDeleted={onBack}
        runUpdate={update.mutate}
        runDelete={del.mutate}
      />
    </GlassPanel>
  );
}
