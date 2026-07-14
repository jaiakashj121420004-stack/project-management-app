import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { NoteEmbedView } from './NoteEmbedView';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    noteEmbed: {
      /** Insert a safe audio/video embed (Pro). embedUrl is the canonical iframe
       *  src produced by parseEmbedUrl — never a raw user string. */
      insertNoteEmbed: (attrs: {
        embedUrl: string;
        kind: 'audio' | 'video';
        provider: string;
      }) => ReturnType;
    };
  }
}

/**
 * A block node embedding an allow-listed audio/video player (YouTube, Vimeo,
 * Loom, SoundCloud) in a note — a Pro feature. Stores only the canonical embed
 * URL we built (see canvas embeds.ts), so a stored note can't smuggle a foreign
 * iframe. Atom node; the player is rendered by NoteEmbedView.
 */
export const NoteEmbed = Node.create({
  name: 'noteEmbed',
  group: 'block',
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      embedUrl: { default: null },
      kind: { default: 'video' },
      provider: { default: '' },
      width: {
        default: null,
        parseHTML: (el: HTMLElement) => {
          const w = el.getAttribute('data-width');
          return w ? Number(w) : null;
        },
        renderHTML: (attrs: Record<string, unknown>) =>
          attrs.width ? { 'data-width': String(attrs.width) } : {},
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-note-embed]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-note-embed': '' })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(NoteEmbedView);
  },

  addCommands() {
    return {
      insertNoteEmbed:
        (attrs) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs }),
    };
  },
});
