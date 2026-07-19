import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { NoteImageView } from './NoteImageView';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    noteImage: {
      /** Insert an uploaded image by its note-media storage path. */
      insertNoteImage: (attrs: { path: string; alt?: string }) => ReturnType;
    };
  }
}

/**
 * An image block in a note. Stores the private storage PATH (not a URL); the
 * node view resolves a short-lived signed URL at render, so the image stays as
 * private as the note. Atom node — can't break the surrounding document.
 */
export const NoteImage = Node.create({
  name: 'noteImage',
  group: 'block',
  atom: true,
  selectable: true,
  // NOT draggable: node-drag would hijack the resize-handle pointer gesture.

  addAttributes() {
    return {
      path: { default: null },
      alt: { default: '' },
      // Display width as a percentage of the content column (null = full width).
      width: {
        default: null,
        parseHTML: (el: HTMLElement) => {
          const w = el.getAttribute('data-width');
          return w ? Number(w) : null;
        },
        renderHTML: (attrs: Record<string, unknown>) =>
          typeof attrs.width === 'number' ? { 'data-width': String(attrs.width) } : {},
      },
    };
  },

  parseHTML() {
    return [{ tag: 'img[data-note-image]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['img', mergeAttributes(HTMLAttributes, { 'data-note-image': '' })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(NoteImageView);
  },

  addCommands() {
    return {
      insertNoteImage:
        (attrs) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs }),
    };
  },
});
