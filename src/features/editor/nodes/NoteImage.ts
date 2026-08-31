import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { NodeSelection, Plugin, PluginKey } from '@tiptap/pm/state';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import type { EditorView } from '@tiptap/pm/view';
import { NoteImageView } from './NoteImageView';
import { uploadNoteImage } from '@/features/notes/noteMedia';
import { MediaUploadError } from '@/lib/storage';

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
 * Finds the noteImage node carrying `uploadId` (if it's still in the doc — the
 * user may have deleted or undone it while the upload was in flight) and patches
 * its attrs in place. Used to swap a paste's "uploading…" placeholder for the
 * real path, or to mark it failed, once `uploadNoteImage` settles.
 */
function patchUploadingImage(view: EditorView, uploadId: string, patch: Record<string, unknown>) {
  const { state } = view;
  let targetPos: number | null = null;
  state.doc.descendants((node, pos) => {
    if (targetPos !== null) return false;
    if (node.type.name === 'noteImage' && node.attrs.uploadId === uploadId) {
      targetPos = pos;
      return false;
    }
    return true;
  });
  if (targetPos === null) return;
  const node = state.doc.nodeAt(targetPos);
  if (!node) return;
  view.dispatch(state.tr.setNodeMarkup(targetPos, undefined, { ...node.attrs, ...patch }));
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

  addOptions() {
    return {
      // The note this editor instance belongs to, so pasted images upload to the
      // right note-media path. Set via `.configure({ noteId })` in
      // NoteBlockEditor — null (paste-upload disabled) for any other consumer.
      noteId: null as string | null,
    };
  },

  addAttributes() {
    return {
      // Rendered as `data-path` (not a bare `path` attribute) for two reasons:
      // it matches the `width` → `data-width` pattern just below, and — the
      // reason this actually matters — DOMPurify's default allow-list (used by
      // serialize.ts's sanitizeBlockHtml on every static render) only keeps
      // standard HTML attributes plus `data-*`/`aria-*`; a bare `path="…"`
      // attribute would be silently stripped, leaving the PDF/read-only
      // renderer with no way to resolve the image's signed URL.
      path: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute('data-path'),
        renderHTML: (attrs: Record<string, unknown>) =>
          typeof attrs.path === 'string' && attrs.path ? { 'data-path': attrs.path } : {},
      },
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
      // The following three are ephemeral, paste-upload-in-flight state only —
      // never meaningful in the static HTML renderer, so they're hidden from it.
      uploading: { default: false, parseHTML: () => false, renderHTML: () => ({}) },
      uploadError: { default: null as string | null, parseHTML: () => null, renderHTML: () => ({}) },
      uploadId: { default: null as string | null, parseHTML: () => null, renderHTML: () => ({}) },
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

  /**
   * Ctrl+V an image straight into a note: same `uploadNoteImage` upload path
   * (and the same validation/error copy) as the toolbar's file picker, just
   * triggered from the clipboard instead of a file input. Lives here — rather
   * than in BlockEditor's shared editorProps — so it can never fire for canvas
   * text boxes, which don't include this extension.
   */
  addProseMirrorPlugins() {
    const noteId = this.options.noteId;
    const nodeType = this.type;

    return [
      new Plugin({
        key: new PluginKey('noteImagePaste'),
        props: {
          handlePaste: (view, event) => {
            if (!noteId) return false;

            const items = event.clipboardData?.items;
            if (!items) return false;

            let imageFile: File | null = null;
            for (const item of Array.from(items)) {
              if (item.type.startsWith('image/')) {
                const file = item.getAsFile();
                if (file) {
                  imageFile = file;
                  break;
                }
              }
            }
            if (!imageFile) return false;

            event.preventDefault();

            const uploadId = crypto.randomUUID();
            const placeholder = nodeType.create({
              path: null,
              uploading: true,
              uploadError: null,
              uploadId,
            });
            view.dispatch(view.state.tr.replaceSelectionWith(placeholder, false).scrollIntoView());

            uploadNoteImage(noteId, imageFile)
              .then(({ path }) => {
                patchUploadingImage(view, uploadId, {
                  path,
                  uploading: false,
                  uploadError: null,
                  uploadId: null,
                });
              })
              .catch((error: unknown) => {
                const message =
                  error instanceof MediaUploadError ? error.message : 'Upload failed — please try again.';
                patchUploadingImage(view, uploadId, { uploading: false, uploadError: message });
              });

            return true;
          },
        },
      }),
    ];
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
