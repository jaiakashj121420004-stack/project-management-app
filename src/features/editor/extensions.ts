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
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import { TaskList } from '@tiptap/extension-task-list';
import { TaskItem } from '@tiptap/extension-task-item';
import { Details, DetailsSummary, DetailsContent } from '@tiptap/extension-details';
import { Collaboration } from '@tiptap/extension-collaboration';
import { CollaborationCaret } from '@tiptap/extension-collaboration-caret';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { MathInline, MathBlock } from './nodes/MathFormula';
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
              typeof attrs.listStyle === 'string'
                ? { 'data-list-style': attrs.listStyle }
                : {},
          },
        },
      },
    ];
  },
});

/**
 * Generates a stable, URL-safe anchor id for a heading. Random rather than
 * derived from the heading's text — a text-derived slug would change (and
 * break every existing link to it) the moment someone edits the heading's
 * wording, which defeats the point of a stable anchor. `crypto.randomUUID()`
 * is this repo's existing convention for client-generated ids (see e.g.
 * NoteImage.ts's uploadId, or any `tempId` in the mutation hooks).
 */
function generateHeadingId(): string {
  return `heading-${crypto.randomUUID()}`;
}

/**
 * Adds a stable `id` attribute to every heading, and keeps it populated:
 *  - `onCreate` walks the doc once at mount and assigns an id to any heading
 *    that doesn't have one yet — this is what lets an OLD document (saved
 *    before this feature existed) get anchors "lazily on first render"
 *    instead of needing a migration pass over every note.
 *  - the `appendTransaction` plugin does the same on every doc-changing
 *    transaction after that, so a heading created later (typing "# ", the
 *    slash menu, a paste) gets its id the moment it's created too.
 * Both are idempotent (skip headings that already have an id), so this never
 * loops and never overwrites an existing anchor — the id is generated once
 * and then just carried along with the node like any other attribute.
 *
 * NOTE: this only runs inside a live `Editor` instance (onCreate/appendTransaction
 * both need an EditorView). `generateHTML` (serialize.ts's static render) builds
 * HTML straight from stored JSON without creating a view, so it prints whatever
 * id is already IN the stored doc and won't backfill a missing one — not an
 * issue today since every note surface (edit, read-only View mode, and a
 * shared viewer) renders through the live editor, never that static path (see
 * NoteEditor.tsx) — but worth knowing if a static note render is added later.
 */
const HeadingId = Extension.create({
  name: 'headingId',
  addGlobalAttributes() {
    return [
      {
        types: ['heading'],
        attributes: {
          id: {
            default: null,
            parseHTML: (el: HTMLElement) => el.getAttribute('id'),
            renderHTML: (attrs: Record<string, unknown>) =>
              typeof attrs.id === 'string' && attrs.id ? { id: attrs.id } : {},
          },
        },
      },
    ];
  },
  onCreate() {
    const { state, view } = this.editor;
    let tr = state.tr;
    let changed = false;
    state.doc.descendants((node, pos) => {
      if (node.type.name === 'heading' && !node.attrs.id) {
        tr = tr.setNodeMarkup(pos, undefined, { ...node.attrs, id: generateHeadingId() });
        changed = true;
      }
    });
    if (changed) view.dispatch(tr);
  },
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('headingIdAutoAssign'),
        appendTransaction: (transactions, _oldState, newState) => {
          if (!transactions.some((tr) => tr.docChanged)) return null;
          const tr = newState.tr;
          let changed = false;
          newState.doc.descendants((node, pos) => {
            if (node.type.name === 'heading' && !node.attrs.id) {
              tr.setNodeMarkup(pos, undefined, { ...node.attrs, id: generateHeadingId() });
              changed = true;
            }
          });
          return changed ? tr : null;
        },
      }),
    ];
  },
});

/**
 * The shared block schema. StarterKit v3 bundles bold, italic, underline, strike,
 * code, headings, bullet/ordered lists, blockquote, code block and horizontal
 * rule; we add Highlight (multicolor), TextStyle + Color (custom colours),
 * SafeLink, Subscript/Superscript marks, task lists, collapsible Details blocks,
 * the list-style attribute, stable per-heading anchor ids (HeadingId — powers
 * the notes Contents/jump-to-heading panel), and inline/block math formulas
 * (MathInline/MathBlock — see nodes/MathFormula.ts). StarterKit's own Link is
 * disabled in favour of SafeLink. Headings go to 3 levels (notes are documents,
 * unlike the 2-level canvas text box of P3.3).
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
  Subscript,
  Superscript,
  TaskList,
  TaskItem.configure({ nested: true }),
  Details.configure({ persist: true, HTMLAttributes: { class: 'tt-details' } }),
  DetailsSummary,
  DetailsContent,
  ListStyle,
  HeadingId,
  MathInline,
  MathBlock,
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
    Subscript,
    Superscript,
    TaskList,
    TaskItem.configure({ nested: true }),
    Details.configure({ persist: true, HTMLAttributes: { class: 'tt-details' } }),
    DetailsSummary,
    DetailsContent,
    ListStyle,
    HeadingId,
    MathInline,
    MathBlock,
    Collaboration.configure({ fragment: opts.fragment }),
    CollaborationCaret.configure({ provider: opts.provider, user: opts.user }),
  ];
}
