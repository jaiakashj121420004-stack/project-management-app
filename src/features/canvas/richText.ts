/**
 * richText.ts — shared Tiptap configuration for canvas text boxes (P3.3).
 *
 * A text element stores its content as Tiptap document JSON in `element.body`
 * (full-fidelity, re-editable) plus a plain-text mirror in `element.text` (used
 * for previews + the empty-state check). Both the live editor (RichTextBox) and
 * the static renderer (TextLayer) must use the SAME extension list, so it lives
 * here once. Konva-free — safe to import from the lazy canvas chunk.
 */
import { generateHTML, type JSONContent } from '@tiptap/core';
import { StarterKit } from '@tiptap/starter-kit';
import { Highlight } from '@tiptap/extension-highlight';

/**
 * The canvas rich-text feature set. StarterKit v3 already bundles bold, italic,
 * underline, strike, code, headings, bullet/ordered lists, blockquote and
 * horizontal rule; Highlight adds the marker. Heading is capped at two levels so
 * a text box stays a text box, not a document.
 */
export const textExtensions = [
  StarterKit.configure({
    heading: { levels: [1, 2] },
  }),
  Highlight,
];

/** An empty Tiptap document (a single empty paragraph) for a brand-new box. */
export function emptyTextDoc(): JSONContent {
  return { type: 'doc', content: [{ type: 'paragraph' }] };
}

/**
 * Render a stored Tiptap document to an HTML string for static (non-editing)
 * display. Returns '' for an empty/missing body so callers can show their own
 * placeholder. Defensive: a malformed body never throws past this boundary.
 *
 * Results are cached by body reference (a body object is replaced, never mutated,
 * on every edit) so panning/zooming — which re-renders the overlay every frame —
 * doesn't re-serialise every text box each time.
 */
const htmlCache = new WeakMap<object, string>();

export function renderTextHtml(body: Record<string, unknown> | null): string {
  if (!body) return '';
  const cached = htmlCache.get(body);
  if (cached !== undefined) return cached;
  try {
    const html = generateHTML(body, textExtensions);
    htmlCache.set(body, html);
    return html;
  } catch {
    htmlCache.set(body, '');
    return '';
  }
}

/**
 * Flatten a Tiptap document to plain text (newline between block nodes). Used for
 * the `element.text` mirror that drives previews + the empty-state check. Walks
 * the JSON directly so it needs no editor instance.
 */
export function docToPlainText(body: Record<string, unknown> | null): string {
  if (!body) return '';
  const blocks: string[] = [];

  const walk = (node: JSONContent): string => {
    if (node.type === 'text') return node.text ?? '';
    const inner = (node.content ?? []).map(walk).join('');
    return inner;
  };

  const doc = body as JSONContent;
  for (const child of doc.content ?? []) {
    blocks.push(walk(child));
  }
  return blocks.join('\n').trim();
}

/** True when a body has no visible text (drives the dashed empty-box hint). */
export function isEmptyDoc(body: Record<string, unknown> | null): boolean {
  return docToPlainText(body).length === 0;
}
