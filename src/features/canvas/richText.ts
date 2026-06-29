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
import { Color, TextStyle } from '@tiptap/extension-text-style';
import { Link } from '@tiptap/extension-link';

/**
 * Allow only safe link targets, mirroring the notes markdown allow-list. Returns
 * the trimmed URL for http/https/mailto, else null. A `javascript:`, `data:` or
 * any other scheme is rejected — this is the single source of truth for link
 * safety, used both by the toolbar (before setting a link) and by the schema
 * below (on parse + render), so an XSS href can never reach the DOM.
 */
export function safeLinkHref(raw: string): string | null {
  const url = raw.trim();
  return /^(https?:\/\/|mailto:)/i.test(url) ? url : null;
}

/**
 * Link, hardened. The body is untrusted jsonb from the DB and the static
 * renderer feeds generateHTML output straight into dangerouslySetInnerHTML, so
 * the href is sanitised on BOTH parse and render: a stored `javascript:`/`data:`
 * URL is dropped to no href rather than emitted. Opens in a new tab with
 * `rel="noopener noreferrer nofollow"`, and never navigates on click while
 * editing.
 */
const SafeLink = Link.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      href: {
        default: null,
        parseHTML: (el: HTMLElement) => safeLinkHref(el.getAttribute('href') ?? ''),
        renderHTML: (attrs: Record<string, unknown>) => {
          const safe = safeLinkHref(typeof attrs.href === 'string' ? attrs.href : '');
          return safe ? { href: safe } : {};
        },
      },
    };
  },
}).configure({
  openOnClick: false,
  autolink: true,
  protocols: ['http', 'https', 'mailto'],
  HTMLAttributes: { rel: 'noopener noreferrer nofollow', target: '_blank' },
});

/**
 * The canvas rich-text feature set. StarterKit v3 already bundles bold, italic,
 * underline, strike, code, headings, bullet/ordered lists, blockquote and
 * horizontal rule; Highlight adds the marker; TextStyle + Color add per-range
 * text colour. StarterKit's own Link is disabled in favour of the sanitising
 * SafeLink above. Heading is capped at two levels so a text box stays a text
 * box, not a document.
 *
 * Both the live editor (RichTextBox) and the static renderer (TextLayer) import
 * this same list, so a box looks identical whether or not it's being edited. In
 * P3.7 the body becomes a Yjs fragment for collaborative editing; this stays a
 * plain extension list so that swap is isolated to RichTextBox.
 */
export const textExtensions = [
  StarterKit.configure({
    heading: { levels: [1, 2] },
    link: false,
  }),
  Highlight,
  TextStyle,
  Color,
  SafeLink,
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
