// Public barrel for the shared block editor.
//
// NOTE: `BlockEditor` is intentionally NOT re-exported here — it (and Tiptap's
// React bundle + editor.css) must stay code-split, so call sites lazy-import the
// component directly: `lazy(() => import('@/features/editor/BlockEditor'))`.
// These barrel exports are the lightweight schema + serialise helpers, safe to
// import from other lazy chunks (canvas) or the notes data layer.
export {
  blockExtensions,
  collabBlockExtensions,
  safeLinkHref,
  BULLET_LIST_STYLES,
  ORDERED_LIST_STYLES,
  type CaretUser,
} from './extensions';
export {
  emptyDoc,
  renderBlockHtml,
  docToPlainText,
  isEmptyDoc,
  markdownToDoc,
} from './serialize';
