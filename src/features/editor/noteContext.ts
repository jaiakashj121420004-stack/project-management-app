import { createContext, useContext } from 'react';

/** Identifies the note a block editor is rendering, so embedded nodes (the
 *  canvas card) can link back to it. Tiptap React node views inherit context
 *  from where <EditorContent> is mounted, so the provider wraps the editor. */
export interface NoteRef {
  noteId: string;
  noteTitle: string;
}

export const NoteContext = createContext<NoteRef | null>(null);

export function useNoteRef(): NoteRef | null {
  return useContext(NoteContext);
}
