/**
 * richText.ts — canvas text now uses the ONE shared block schema (Nvexis Phase 3).
 *
 * Previously the canvas defined its own Tiptap extension list. It now re-exports
 * the shared editor's schema + serialise helpers under the names the canvas
 * already imports, so canvas text boxes and standalone/project notes share
 * exactly one content model and renderer — a document authored in either place
 * round-trips losslessly. New block types (task lists, toggle blocks, custom list
 * styles, H3) are styled for the canvas overlay in canvasText.css.
 *
 * Kept as a thin shim so the canvas files (RichTextBox / TextLayer / CanvasStage /
 * TextFormatToolbar / collab/yCanvasDoc) need no import changes.
 */
export {
  blockExtensions as textExtensions,
  collabBlockExtensions as collabTextExtensions,
  safeLinkHref,
  type CaretUser,
} from '@/features/editor/extensions';

export {
  renderBlockHtml as renderTextHtml,
  docToPlainText,
  isEmptyDoc,
  emptyDoc as emptyTextDoc,
} from '@/features/editor/serialize';
