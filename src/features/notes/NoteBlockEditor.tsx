import { useMemo, useState } from 'react';
import type { AnyExtension, JSONContent } from '@tiptap/core';
import { BlockEditor } from '@/features/editor/BlockEditor';
import { markdownToDoc } from '@/features/editor/serialize';
import { CanvasLink } from '@/features/editor/nodes/CanvasLink';
import { NoteImage } from '@/features/editor/nodes/NoteImage';
import { NoteEmbed } from '@/features/editor/nodes/NoteEmbed';
import { noteTableExtensions } from '@/features/editor/nodes/tableExtensions';
import { MoveBlock } from '@/features/editor/nodes/moveBlock';
import { NoteContext } from '@/features/editor/noteContext';
import type { Note } from '@/types/database';

/**
 * Bridges a Note to the shared BlockEditor. Lives in the lazy chunk (Tiptap +
 * the markdown converter load only when a note is opened). Seeds the editor from
 * the note's block document, or — for a legacy note not yet migrated — by parsing
 * its markdown `content` once. Default export so NoteEditor can React.lazy it.
 */
export default function NoteBlockEditor({
  note,
  editable,
  onChange,
}: {
  note: Note;
  editable: boolean;
  onChange: (doc: JSONContent, plainText: string) => void;
}) {
  // Seed once per mount; the parent re-keys by note id, so a new note remounts.
  const [initial] = useState<JSONContent>(() =>
    note.content_json ? note.content_json : markdownToDoc(note.content),
  );

  // Note-only extensions (Insert-canvas + images + embeds + tables — the
  // canvas text editor never gets them). Rebuilt via useMemo keyed on note.id
  // rather than a plain module constant: NoteImage needs `.configure({ noteId })`
  // so a pasted image (Ctrl+V) uploads to THIS note's media path — a ProseMirror
  // plugin has no access to the NoteContext React context the toolbar uses, so
  // the id has to be baked into the extension itself. Still only built once per
  // note mount (this component remounts per note.id, same as BlockEditor's own
  // "built once" contract for extraExtensions).
  const noteExtensions = useMemo<AnyExtension[]>(
    () => [CanvasLink, NoteImage.configure({ noteId: note.id }), NoteEmbed, MoveBlock, ...noteTableExtensions],
    [note.id],
  );

  return (
    <NoteContext.Provider value={{ noteId: note.id, noteTitle: note.title }}>
      <BlockEditor
        content={initial}
        editable={editable}
        onChange={onChange}
        extraExtensions={noteExtensions}
        showToc
        dragHandle
      />
    </NoteContext.Provider>
  );
}
