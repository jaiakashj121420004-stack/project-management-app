import { useState } from 'react';
import type { JSONContent } from '@tiptap/core';
import { BlockEditor } from '@/features/editor/BlockEditor';
import { markdownToDoc } from '@/features/editor/serialize';
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
    note.content_json ? (note.content_json as JSONContent) : markdownToDoc(note.content),
  );

  return <BlockEditor content={initial} editable={editable} onChange={onChange} />;
}
