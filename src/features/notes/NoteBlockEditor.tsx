import { useState } from 'react';
import type { AnyExtension, JSONContent } from '@tiptap/core';
import { BlockEditor } from '@/features/editor/BlockEditor';
import { markdownToDoc } from '@/features/editor/serialize';
import { CanvasLink } from '@/features/editor/nodes/CanvasLink';
import { NoteImage } from '@/features/editor/nodes/NoteImage';
import { NoteEmbed } from '@/features/editor/nodes/NoteEmbed';
import { NoteContext } from '@/features/editor/noteContext';
import type { Note } from '@/types/database';

// Note-only extensions (stable reference — the editor is built once). Insert
// canvas + images + embeds live here so the canvas text editor never gets them.
const NOTE_EXTENSIONS: AnyExtension[] = [CanvasLink, NoteImage, NoteEmbed];

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
    note.content_json ? (note.content_json as JSONContent) : markdownToDoc(note.content),
  );

  return (
    <NoteContext.Provider value={{ noteId: note.id, noteTitle: note.title }}>
      <BlockEditor
        content={initial}
        editable={editable}
        onChange={onChange}
        extraExtensions={NOTE_EXTENSIONS}
      />
    </NoteContext.Provider>
  );
}
