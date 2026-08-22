/**
 * MathFormula.ts — inline and block LaTeX math formulas, rendered via KaTeX.
 *
 * No maintained MIT-licensed Tiptap-v3 math extension fits this repo's
 * dependency graph without collateral risk. The official `@tiptap/extension-
 * mathematics` (MIT, KaTeX-based, exactly the shape this file needs — latex
 * stored in `node.attrs.latex`, both inline and block node variants) exists,
 * but its published release (3.30.2) pins its `@tiptap/core` peer dependency
 * to that *exact* version, while every other `@tiptap/*` package in this repo
 * is pinned to the 3.27.1 family — adopting it would force-bump the entire
 * Tiptap dependency graph (core, react, pm, starter-kit, collaboration, table,
 * …) as a side effect of adding math support, right after this same schema
 * file was the source of a same-week regression (the Notes table bug). Built
 * as two plain custom Nodes instead: same latex-in-attrs storage model the
 * official extension uses (a plain string, not pre-rendered HTML — safe for
 * the Yjs CRDT and re-renderable by the static viewer), same KaTeX renderer,
 * zero dependency-graph risk. See memory.md's decision log.
 *
 * Both nodes share one NodeView (MathFormulaView.tsx) for the live editor and
 * one `renderHTML` builder (below) for the static/read-only view — the static
 * path returns an actual DOM element (KaTeX rendered into it via `katex.
 * render()`) rather than a DOMOutputSpec array, which ProseMirror's toDOM
 * explicitly supports, so `generateHTML` (serialize.ts) shows the real
 * formula instead of an empty tag. This was verified against the exact same
 * table-node bug class just fixed in serialize.ts: an unknown/inert node
 * schema silently renders as nothing for anyone viewing (not editing) a note.
 */
import { Node } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import katex from 'katex';
import { MathFormulaView } from './MathFormulaView';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    mathInline: {
      /** Insert an inline `$x^2$`-style formula. Empty/omitted latex opens
       *  straight into the edit popover (see MathFormulaView). */
      insertMathInline: (attrs?: { latex?: string }) => ReturnType;
    };
    mathBlock: {
      /** Insert a standalone, centred `$$...$$`-style display formula. */
      insertMathBlock: (attrs?: { latex?: string }) => ReturnType;
    };
  }
}

/** Shared `latex` attribute: the plain LaTeX source is the only thing
 *  persisted (never pre-rendered HTML), so it stays a serializable value a
 *  Yjs CRDT can carry and the static renderer can re-render for itself.
 *  `renderHTML` is intentionally omitted here — the node-level `renderHTML`
 *  below builds the whole element itself (including `data-latex`) so it can
 *  embed KaTeX's rendered markup, bypassing the normal per-attribute
 *  HTMLAttributes merge. */
function latexAttribute() {
  return {
    latex: {
      default: '',
      parseHTML: (el: HTMLElement) => el.getAttribute('data-latex') ?? '',
    },
  };
}

/**
 * Build the static-render DOM element for a math node: the wrapper (span for
 * inline, div for block) carrying `data-latex` (so parseHTML round-trips) and
 * `data-math-inline`/`data-math-block` (so parseHTML matches it), with
 * KaTeX's rendered output as its content. `output: 'html'` (skip the parallel
 * MathML accessibility tree) keeps this simple and was verified to survive
 * `sanitizeBlockHtml`'s DOMPurify pass unchanged — MathML tags/attrs aren't
 * needed for DOMPurify to keep KaTeX's actual HTML output intact, so there's
 * nothing to lose by leaving it out and one less thing to verify against the
 * sanitizer. Invalid LaTeX never throws past this boundary — it falls back to
 * the raw source as plain text, flagged with a class for a subtle style hook.
 */
function buildMathElement(latex: string, isBlock: boolean): HTMLElement {
  const el = document.createElement(isBlock ? 'div' : 'span');
  el.setAttribute(isBlock ? 'data-math-block' : 'data-math-inline', '');
  el.setAttribute('data-latex', latex);
  const trimmed = latex.trim();
  if (trimmed) {
    try {
      katex.render(trimmed, el, { throwOnError: true, displayMode: isBlock, output: 'html' });
    } catch {
      el.textContent = trimmed;
      el.classList.add('math-render-error');
    }
  }
  return el;
}

/**
 * An inline math formula (`$x^2$`-style). Atom + selectable, like NoteImage —
 * it can't break the surrounding document, and click-to-edit is handled by
 * its NodeView rather than relying on ProseMirror's default node selection.
 */
export const MathInline = Node.create({
  name: 'mathInline',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return latexAttribute();
  },

  parseHTML() {
    return [{ tag: 'span[data-math-inline]' }];
  },

  renderHTML({ node }) {
    return buildMathElement(typeof node.attrs.latex === 'string' ? node.attrs.latex : '', false);
  },

  addNodeView() {
    return ReactNodeViewRenderer(MathFormulaView);
  },

  addCommands() {
    return {
      insertMathInline:
        (attrs) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: { latex: attrs?.latex ?? '' } }),
    };
  },
});

/**
 * A standalone display formula (`$$...$$`-style), centred on its own line.
 * Same latex-in-attrs model and shared NodeView/renderer as MathInline.
 */
export const MathBlock = Node.create({
  name: 'mathBlock',
  group: 'block',
  atom: true,
  selectable: true,

  addAttributes() {
    return latexAttribute();
  },

  parseHTML() {
    return [{ tag: 'div[data-math-block]' }];
  },

  renderHTML({ node }) {
    return buildMathElement(typeof node.attrs.latex === 'string' ? node.attrs.latex : '', true);
  },

  addNodeView() {
    return ReactNodeViewRenderer(MathFormulaView);
  },

  addCommands() {
    return {
      insertMathBlock:
        (attrs) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: { latex: attrs?.latex ?? '' } }),
    };
  },
});
