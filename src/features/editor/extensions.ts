/**
 * extensions.ts — the ONE shared Tiptap schema for the whole app (Nvexis Phase 3).
 *
 * Both standalone/project notes AND canvas text boxes use this exact extension
 * list, so content authored in one place renders identically everywhere and a
 * document round-trips losslessly through save/load. The live editor
 * (BlockEditor / RichTextBox) and the static renderer (generateHTML in
 * serialize.ts) MUST share this schema, or unknown nodes would be dropped.
 *
 * Konva-free — safe to import from the lazy canvas chunk and the notes routes.
 */
import { Extension } from '@tiptap/core';
import { StarterKit } from '@tiptap/starter-kit';
import { Highlight } from '@tiptap/extension-highlight';
import { Color, TextStyle } from '@tiptap/extension-text-style';
import { Link } from '@tiptap/extension-link';
import { TaskList } from '@tiptap/extension-task-list';
import { TaskItem } from '@tiptap/extension-task-item';
import { Collaboration } from '@tiptap/extension-collaboration';
import { CollaborationCaret } from '@tiptap/extension-collaboration-caret';
import type { AnyExtension } from '@tiptap/core';
import type { XmlFragment } from 'yjs';

/**
 * Allow only safe link targets. Returns the trimmed URL for http/https/mailto,
 * else null — a `javascript:`/`data:`/other scheme is rejected. Single source of
 * truth for link safety, used by the toolbar (before setting a link) and by the
 * schema below (on parse + render), so an XSS href can never reach the DOM.
 */
export function safeLinkHref(raw: string): string | null {
  const url = raw.trim();
  return /^(https?:\/\/|mailto:)/i.test(url) ? url : null;
}

/**
 * Link, hardened. The stored body is untrusted jsonb and the static renderer
 * feeds generateHTML output into dangerouslySetInnerHTML, so the href is
 * sanitised on BOTH parse and render. Opens in a new tab; never navigates while
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
 * The list-style names a user can pick for bullet and ordered lists. Applied as a
 * `data-list-style` attribute and styled by CSS `list-style-type` in editor.css
 * (Tailwind's preflight resets lists, so the variants are restored there).
 */
export const BULLET_LIST_STYLES = ['disc', 'circle', 'square', 'hyphen'] as const;
export const ORDERED_LIST_STYLES = [
  'decimal',
  'lower-alpha',
  'upper-alpha',
  'lower-roman',
  'upper-roman',
] as const;

/**
 * Adds a `listStyle` attribute to bulletList + orderedList without replacing
 * StarterKit's list nodes. Renders as `data-list-style="…"`; editor.css maps that
 * to the matching `list-style-type`. Kept in the shared list so the attribute
 * survives generateHTML (static render) too.
 */
const ListStyle = Extension.create({
  name: 'listStyle',
  addGlobalAttributes() {
    return [
      {
        types: ['bulletList', 'orderedList'],
        attributes: {
          listStyle: {
            default: null,
            parseHTML: (el: HTMLElement) => el.getAttribute('data-list-style'),
            renderHTML: (attrs: Record<string, unknown>) =>
              attrs.listStyle ? { 'data-list-style': String(attrs.listStyle) } : {},
          },
        },
      },
    ];
  },
});

/**
 * The shared block schema. StarterKit v3 bundles bold, italic, underline, strike,
 * code, headings, bullet/ordered lists, blockquote, code block and horizontal
 * rule; we add Highlight (multicolor), TextStyle + Color (custom colours),
 * SafeLink, task lists, collapsible Details blocks and the list-style attribute.
 * StarterKit's own Link is disabled in favour of SafeLink. Headings go to 3
 * levels (notes are documents, unlike the 2-level canvas text box of P3.3).
 */
export const blockExtensions: AnyExtension[] = [
  StarterKit.configure({
    heading: { levels: [1, 2, 3] },
    link: false,
  }),
  Highlight.configure({ multicolor: true }),
  TextStyle,
  Color,
  SafeLink,
  TaskList,
  TaskItem.configure({ nested: true }),
  ListStyle,
];

/** The participant shown by the collaborative caret (name + cursor colour). */
export interface CaretUser {
  name: string;
  color: string;
}

/**
 * The COLLABORATIVE variant for a live editor bound to a Yjs fragment (canvas
 * text boxes today; notes in Phase 4). Identical schema to blockExtensions so
 * fragment ⇄ JSON conversion stays consistent, but StarterKit's local history is
 * disabled (Yjs owns undo/redo) and Collaboration + CollaborationCaret are added.
 * `content` must NOT be passed to a collaborative editor — the fragment is the
 * source of truth.
 */
export function collabBlockExtensions(opts: {
  fragment: XmlFragment;
  provider: { awareness: unknown };
  user: CaretUser;
}): AnyExtension[] {
  return [
    StarterKit.configure({ heading: { levels: [1, 2, 3] }, link: false, undoRedo: false }),
    Highlight.configure({ multicolor: true }),
    TextStyle,
    Color,
    SafeLink,
    TaskList,
    TaskItem.configure({ nested: true }),
    ListStyle,
    Collaboration.configure({ fragment: opts.fragment }),
    CollaborationCaret.configure({ provider: opts.provider, user: opts.user }),
  ];
}
