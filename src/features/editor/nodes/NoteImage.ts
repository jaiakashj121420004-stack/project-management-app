import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { NodeSelection } from '@tiptap/pm/state';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { NoteImageView } from './NoteImageView';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    noteImage: {
      /** Insert an uploaded image by its note-media storage path. */
      insertNoteImage: (attrs: { path: string; alt?: string }) => ReturnType;
    };
  }
}

/** Transaction meta key used to tell the selected image's NodeView "you were
 *  backspaced but not deleted yet" so it can show a brief cue. */
export const NOTE_IMAGE_BACKSPACE_META = 'noteImageBackspaceCue';

/** Consecutive Backspace presses required, while the image is the selected
 *  node, before it actually deletes (the deliberate Trash2 button in
 *  NoteImageView bypasses this entirely). */
const BACKSPACE_PRESSES_TO_DELETE = 3;

// Module-level (not component state) because the streak must survive across
// Backspace presses even though the image's own NodeView instance doesn't
// change identity here — keyed by node identity so it's automatically stale
// once the doc changes elsewhere. Single-entry: only one node can hold a
// NodeSelection at a time, so there's only ever one active streak.
let backspaceStreak: { node: ProseMirrorNode | null; count: number } = { node: null, count: 0 };

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

  addKeyboardShortcuts() {
    return {
      Backspace: ({ editor }) => {
        const { state, view } = editor;
        const { selection } = state;

        if (!(selection instanceof NodeSelection) || selection.node.type.name !== this.name) {
          // Cursor isn't on a selected image of ours yet. ProseMirror's default
          // Backspace may turn an adjacent cursor into a NodeSelection on this
          // image — that's the "select it" step, not a delete attempt, so it
          // doesn't count toward the streak. Any other selection change clears
          // a stale streak from a previously selected image.
          backspaceStreak = { node: null, count: 0 };
          return false;
        }

        const { node } = selection;
        if (backspaceStreak.node !== node) {
          backspaceStreak = { node, count: 0 };
        }
        backspaceStreak.count += 1;

        if (backspaceStreak.count < BACKSPACE_PRESSES_TO_DELETE) {
          view.dispatch(
            state.tr.setMeta(NOTE_IMAGE_BACKSPACE_META, {
              pos: selection.from,
              pressesLeft: BACKSPACE_PRESSES_TO_DELETE - backspaceStreak.count,
            }),
          );
          return true; // Swallow — keep the node selected, delete nothing yet.
        }

        backspaceStreak = { node: null, count: 0 };
        return false; // Threshold reached — let the default Backspace delete it.
      },
    };
  },
});
