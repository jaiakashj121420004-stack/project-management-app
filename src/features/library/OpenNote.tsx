import { GlassPanel } from '@/components/glass/GlassPanel';
import { NoteEditor } from '@/features/notes/NoteEditor';
import { useSharedItemRole } from '@/features/sharing';
import type { Note } from '@/types/database';
import { useDeleteLibraryNote, useUpdateLibraryNote } from './useLibrary';

/**
 * Opens a standalone Library note in the shared NoteEditor, wired to the
 * library-scoped autosave + delete mutations. Deleting returns to the browser.
 * `canEdit` follows the viewer's REAL access: the owner always edits; a
 * collaborator the note was shared with gets edit rights only if they're an
 * 'editor' (a 'viewer' gets the read-only render, matching what RLS already
 * enforces on writes — this just makes the UI stop offering an edit/delete
 * experience that would silently fail).
 */
export function OpenNote({ note, onBack }: { note: Note; onBack: () => void }) {
  const update = useUpdateLibraryNote();
  const del = useDeleteLibraryNote();
  const { canEdit } = useSharedItemRole('note', note.id, note.owner_id);

  return (
    <GlassPanel className="flex min-h-[70vh] flex-col p-5 sm:p-6">
      <NoteEditor
        key={note.id}
        note={note}
        canEdit={canEdit}
        onDeleted={onBack}
        runUpdate={update.mutate}
        runDelete={del.mutate}
      />
    </GlassPanel>
  );
}
