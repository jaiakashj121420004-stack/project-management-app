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
 * Shared NodeView for MathInline ('span', inline) and MathBlock ('div',
 * centred display), told apart by `node.type.name`. Renders the committed
 * LaTeX via KaTeX; clicking it (when the editor is editable) opens a small
 * inline editor — a text input pre-filled with the source, a live KaTeX
 * preview underneath, Enter or blur to commit, Escape to revert and close. A
 * freshly-inserted node with empty latex opens straight into edit mode.
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
  const inputRef = useRef<HTMLInputElement>(null);
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

  function onInputKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    // Keep Enter/Escape from also reaching ProseMirror's own keymap — this
    // input lives outside the contentEditable region, so that's normally a
    // non-issue, but the toolbar's own link popover guards the same way.
    event.stopPropagation();
    if (event.key === 'Enter') {
      event.preventDefault();
      suppressBlurRef.current = true;
      commit();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      cancel();
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
            'glass-strong inline-flex flex-col gap-1.5 rounded-lg border border-[var(--accent-from)] p-2 shadow-[0_10px_24px_-12px_rgba(0,0,0,0.6)]',
            isBlock && 'w-full',
          )}
        >
          <input
            ref={inputRef}
            type="text"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={onInputKeyDown}
            onBlur={onInputBlur}
            placeholder="LaTeX, e.g. x^2 + y^2 = z^2"
            aria-label="Formula LaTeX source"
            className="min-w-[12rem] rounded-md border border-[var(--glass-border)] bg-[var(--glass-fill)] px-2 py-1 font-mono text-sm text-fg outline-none placeholder:text-fg-subtle"
          />
          <div className="min-h-[1.5em] px-1">
            {draft.trim() === '' ? (
              <span className="text-xs text-fg-subtle">Preview appears here</span>
            ) : preview.error ? (
              <span className="text-xs italic text-danger">Can’t render this yet — check the LaTeX syntax.</span>
            ) : (
              <span className="text-fg" dangerouslySetInnerHTML={{ __html: preview.html }} />
            )}
          </div>
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
