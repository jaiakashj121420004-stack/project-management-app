import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { CanvasLinkView } from './CanvasLinkView';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    canvasLink: {
      /** Insert a clickable card that links to a canvas. */
      insertCanvasLink: (attrs: { canvasId: string; title: string }) => ReturnType;
    };
  }
}

/**
 * A block node that embeds a clickable "canvas card" in a note (Insert canvas —
 * a free, connective feature). It's an ATOM (no editable content), so it can't
 * break the surrounding document; the card is rendered by CanvasLinkView and
 * navigates to the canvas in the Library on click. Added only to the notes
 * editor (never the canvas text schema).
 */
export const CanvasLink = Node.create({
  name: 'canvasLink',
  group: 'block',
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      canvasId: { default: null },
      title: { default: 'Canvas' },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-canvas-link]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-canvas-link': '' })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(CanvasLinkView);
  },

  addCommands() {
    return {
      insertCanvasLink:
        (attrs) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs }),
    };
  },
});
