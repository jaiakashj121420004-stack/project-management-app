import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { cn } from '@/lib/cn';

/** Render LaTeX to KaTeX's HTML output, or report a parse failure instead of
 *  throwing. `output: 'html'` matches MathFormula.ts's static-render builder
 *  (skips the parallel MathML tree — not needed for the visual output, one
 *  less thing to keep verified against the DOMPurify pass). An empty source
 *  renders nothing (the caller shows its own placeholder). */
function renderLatex(source: string, displayMode: boolean): { html: string; error: boolean } {
  const trimmed = source.trim();
  if (trimmed === '') return { html: '', error: false };
  try {
    return { html: katex.renderToString(trimmed, { throwOnError: true, displayMode, output: 'html' }), error: false };
  } catch {
    return { html: '', error: true };
  }
}

/**
 * Quick-insert LaTeX snippets shown above the editor — the actual capability
 * (any KaTeX-renderable LaTeX: integrals, sums, matrices, Greek letters, ...)
 * already existed via the plain text field, but with zero discoverability a
 * free-text box just reads as "type a formula" with no hint *how*. Each
 * `insert` string is spliced in at the caret; a `{}` pair inside it (the
 * "fill this in" spot) gets the caret parked between the braces afterwards,
 * everything else lands the caret at the end of the inserted text.
 */
const MATH_SNIPPETS: readonly { label: string; insert: string; hint: string }[] = [
  { label: '√', insert: '\\sqrt{}', hint: 'Square root' },
  { label: 'ⁿ√', insert: '\\sqrt[n]{}', hint: 'Nth root' },
  { label: 'a⁄b', insert: '\\frac{}{}', hint: 'Fraction' },
  { label: 'xⁿ', insert: '^{}', hint: 'Exponent / superscript' },
  { label: 'xₙ', insert: '_{}', hint: 'Subscript' },
  { label: '∫', insert: '\\int_{}^{}', hint: 'Definite integral' },
  { label: '∬', insert: '\\iint_{}', hint: 'Double integral' },
  { label: 'Σ', insert: '\\sum_{}^{}', hint: 'Summation' },
  { label: 'Π', insert: '\\prod_{}^{}', hint: 'Product' },
  { label: 'lim', insert: '\\lim_{x \\to }', hint: 'Limit' },
  { label: '∂', insert: '\\partial', hint: 'Partial derivative' },
  { label: '∇', insert: '\\nabla', hint: 'Nabla / gradient' },
  { label: '[⋮]', insert: '\\begin{bmatrix} & \\\\ & \\end{bmatrix}', hint: 'Matrix' },
  { label: '±', insert: '\\pm', hint: 'Plus-minus' },
  { label: '×', insert: '\\times', hint: 'Times' },
  { label: '⋅', insert: '\\cdot', hint: 'Dot product' },
  { label: '≤', insert: '\\leq', hint: 'Less than or equal' },
  { label: '≥', insert: '\\geq', hint: 'Greater than or equal' },
  { label: '≠', insert: '\\neq', hint: 'Not equal' },
  { label: '≈', insert: '\\approx', hint: 'Approximately' },
  { label: '∞', insert: '\\infty', hint: 'Infinity' },
  { label: '→', insert: '\\to', hint: 'Arrow' },
  { label: 'α', insert: '\\alpha', hint: 'Alpha' },
  { label: 'β', insert: '\\beta', hint: 'Beta' },
  { label: 'π', insert: '\\pi', hint: 'Pi' },
  { label: 'θ', insert: '\\theta', hint: 'Theta' },
  { label: 'Δ', insert: '\\Delta', hint: 'Delta' },
  { label: 'Ω', insert: '\\Omega', hint: 'Omega' },
];

/**
 * Shared NodeView for MathInline ('span', inline) and MathBlock ('div',
 * centred display), told apart by `node.type.name`. Renders the committed
 * LaTeX via KaTeX; clicking it (when the editor is editable) opens an editor
 * — a monospace textarea pre-filled with the source, a row of tappable LaTeX
 * snippets above it, and a live KaTeX preview below. Enter (inline) or
 * Cmd/Ctrl+Enter (block, since plain Enter needs to stay usable for
 * multi-line matrix source) commits; blur also commits; Escape reverts and
 * closes. A freshly-inserted node with empty latex opens straight into edit
 * mode.
 *
 * The KaTeX output is injected via `dangerouslySetInnerHTML` — safe here
 * because it's KaTeX's own generated markup from a LaTeX string this app
 * controls the input surface of, not raw user HTML. Invalid LaTeX never
 * crashes the editor: it falls back to the raw source, still editable.
 */
export function MathFormulaView({ node, updateAttributes, selected, editor }: NodeViewProps) {
  const isBlock = node.type.name === 'mathBlock';
  const latex = typeof node.attrs.latex === 'string' ? node.attrs.latex : '';
  const editable = editor.isEditable;

  const [editing, setEditing] = useState(editable && latex.trim() === '');
  const [draft, setDraft] = useState(latex);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  // Enter/Escape set this so the input's own blur (fired as React unmounts
  // it on the editing → false transition) doesn't ALSO commit — blur should
  // only act as "commit on click-away", not fire a second time after Enter/
  // Escape already resolved the edit.
  const suppressBlurRef = useRef(false);

  // Autofocus only — re-seeding `draft` happens at the point editing STARTS
  // (the click/keyboard handlers below, and the initial useState above),
  // never here: calling setState synchronously inside an effect body is an
  // anti-pattern (cascading renders) and, for a freshly-mounted node,
  // unnecessary anyway since `draft`'s initial value already equals `latex`.
  useEffect(() => {
    if (!editing) return;
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [editing]);

  function startEditing() {
    if (!editable) return;
    setDraft(latex);
    setEditing(true);
  }

  function commit() {
    updateAttributes({ latex: draft });
    setEditing(false);
  }

  function cancel() {
    suppressBlurRef.current = true;
    setDraft(latex);
    setEditing(false);
  }

  /** Splices a snippet in at the caret (or appends if the textarea isn't
   *  mounted yet). Parks the caret inside the first empty `{}` pair the
   *  snippet introduces, so e.g. tapping "Fraction" leaves you typing
   *  straight into the numerator rather than after the whole `\frac{}{}`. */
  function insertSnippet(snippet: string) {
    const el = inputRef.current;
    const start = el?.selectionStart ?? draft.length;
    const end = el?.selectionEnd ?? draft.length;
    const next = draft.slice(0, start) + snippet + draft.slice(end);
    setDraft(next);
    const braceIdx = snippet.indexOf('{}');
    const caret = start + (braceIdx >= 0 ? braceIdx + 1 : snippet.length);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(caret, caret);
    });
  }

  function onInputKeyDown(event: ReactKeyboardEvent<HTMLTextAreaElement>) {
    // Keep Enter/Escape from also reaching ProseMirror's own keymap — this
    // input lives outside the contentEditable region, so that's normally a
    // non-issue, but the toolbar's own link popover guards the same way.
    event.stopPropagation();
    if (event.key === 'Escape') {
      event.preventDefault();
      cancel();
      return;
    }
    // Inline formulas are one line, so plain Enter commits. Block formulas
    // can legitimately want a newline (e.g. a matrix's `\\` row breaks read
    // better across lines) — commit there is Cmd/Ctrl+Enter, plain Enter
    // inserts a newline like any other textarea.
    const commitKey = isBlock ? event.key === 'Enter' && (event.metaKey || event.ctrlKey) : event.key === 'Enter';
    if (commitKey) {
      event.preventDefault();
      suppressBlurRef.current = true;
      commit();
    }
  }

  function onInputBlur() {
    if (suppressBlurRef.current) {
      suppressBlurRef.current = false;
      return;
    }
    commit();
  }

  const wrapperTag = isBlock ? 'div' : 'span';

  if (editing) {
    const preview = renderLatex(draft, isBlock);
    return (
      <NodeViewWrapper as={wrapperTag} className={isBlock ? 'my-2 block' : 'inline-block align-middle'}>
        <span
          contentEditable={false}
          className={cn(
            'glass-strong inline-flex flex-col gap-2 rounded-lg border border-[var(--accent-from)] p-2.5 shadow-[0_10px_24px_-12px_rgba(0,0,0,0.6)]',
            isBlock ? 'w-full' : 'w-[min(94vw,26rem)]',
          )}
        >
          <div className="flex flex-wrap gap-1 overflow-x-auto pb-0.5" role="group" aria-label="Insert math symbol">
            {MATH_SNIPPETS.map((snippet) => (
              <button
                key={snippet.label}
                type="button"
                title={snippet.hint}
                aria-label={snippet.hint}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => insertSnippet(snippet.insert)}
                className="grid h-7 min-w-[1.75rem] shrink-0 place-items-center rounded-md px-1 font-serif text-sm text-fg-muted transition-colors hover:bg-[var(--glass-fill)] hover:text-fg"
              >
                {snippet.label}
              </button>
            ))}
          </div>
          <textarea
            ref={inputRef}
            value={draft}
            rows={isBlock ? 3 : 2}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={onInputKeyDown}
            onBlur={onInputBlur}
            placeholder="LaTeX, e.g. \frac{-b \pm \sqrt{b^2-4ac}}{2a}"
            aria-label="Formula LaTeX source"
            className="w-full resize-y rounded-md border border-[var(--glass-border)] bg-[var(--glass-fill)] px-2 py-1.5 font-mono text-sm text-fg outline-none placeholder:text-fg-subtle"
          />
          <div className="min-h-[1.5em] overflow-x-auto px-1">
            {draft.trim() === '' ? (
              <span className="text-xs text-fg-subtle">Preview appears here</span>
            ) : preview.error ? (
              <span className="text-xs italic text-danger">Can’t render this yet — check the LaTeX syntax.</span>
            ) : (
              <span className="text-fg" dangerouslySetInnerHTML={{ __html: preview.html }} />
            )}
          </div>
          <p className="px-1 text-[0.65rem] leading-snug text-fg-subtle">
            Full LaTeX math — integrals, sums, matrices, limits, Greek letters and more. Tap a symbol above to insert
            it, or type LaTeX directly. {isBlock ? 'Ctrl/Cmd+Enter' : 'Enter'} to save, Esc to cancel.
          </p>
        </span>
      </NodeViewWrapper>
    );
  }

  const display = renderLatex(latex, isBlock);
  return (
    <NodeViewWrapper as={wrapperTag} className={isBlock ? 'my-2 block text-center' : 'inline-block align-middle'}>
      <span
        contentEditable={false}
        role={editable ? 'button' : undefined}
        tabIndex={editable ? 0 : undefined}
        title={editable ? 'Click to edit formula' : undefined}
        onClick={startEditing}
        onKeyDown={(event) => {
          if (!editable) return;
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            startEditing();
          }
        }}
        className={cn(
          'rounded px-1 py-0.5 transition-colors',
          editable && 'cursor-pointer hover:bg-[var(--glass-fill)]',
          selected && editable && 'ring-1 ring-[var(--accent-from)]',
          display.error && 'font-mono text-xs text-danger underline decoration-dotted',
        )}
      >
        {latex.trim() === '' ? (
          <span className="text-xs italic text-fg-subtle">Empty formula</span>
        ) : display.error ? (
          latex
        ) : (
          <span dangerouslySetInnerHTML={{ __html: display.html }} />
        )}
      </span>
    </NodeViewWrapper>
  );
}
