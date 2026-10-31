import { describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import NoteBlockEditor from '@/features/notes/NoteBlockEditor';
import type { Note } from '@/types/database';

vi.mock('./EditorToolbar', () => ({ EditorToolbar: () => null }));

const note = { id: 'n1', title: 'T', content: '', content_json: null } as unknown as Note;

describe('slash menu in the real notes editor', () => {
  it('opens when "/" is typed on an empty line', async () => {
    render(<NoteBlockEditor note={note} editable onChange={() => undefined} />);
    await waitFor(() => expect(document.querySelector('.ProseMirror')).not.toBeNull());
    const pm = document.querySelector('.ProseMirror') as HTMLElement & { editor?: import('@tiptap/core').Editor };
    const editor = pm.editor!;
    act(() => {
      editor.commands.focus();
      const { view } = editor;
      const handled = view.someProp('handleTextInput', (f) => f(view, view.state.selection.from, view.state.selection.to, '/', () => view.state.tr.insertText('/')));
      if (!handled) view.dispatch(view.state.tr.insertText('/'));
    });
    await waitFor(() => expect(screen.queryByText('Heading 1')).not.toBeNull(), { timeout: 2000 });
  });
});
