/**
 * TableOfContents.tsx — collapsible "Contents" panel for the shared block
 * editor. Reads the LIVE editor's doc (`editor.getJSON()`) and lists every
 * heading with its stable anchor id (see extensions.ts's HeadingId
 * extension), indented by level; clicking one smooth-scrolls the editor's own
 * ProseMirror DOM to that heading and briefly flashes it
 * (`.toc-heading-highlight`, editor.css).
 *
 * Deliberately built off the live `Editor` instance rather than a separate
 * static render — that's what makes it work identically in edit mode,
 * read-only View mode, and for a shared viewer (canEdit=false): all three
 * mount the exact same non-editable Tiptap editor (see NoteEditor.tsx /
 * NoteBlockEditor.tsx), never a static HTML render.
 *
 * Wired in by BlockEditor.tsx behind an opt-in `showToc` prop (same pattern
 * as its `dragHandle` prop) — notes turn it on, canvas text boxes never do.
 */
import { useEffect, useState } from 'react';
import type { Editor, JSONContent } from '@tiptap/core';
import { List, X } from 'lucide-react';
import { cn } from '@/lib/cn';

interface HeadingEntry {
  id: string;
  level: number;
  text: string;
}

/** Headings in this schema are always top-level (StarterKit doesn't allow
 *  nesting a heading inside another block), so a shallow scan of the doc's
 *  own children is enough — no need to walk the full tree. */
function extractHeadings(doc: JSONContent): HeadingEntry[] {
  const headings: HeadingEntry[] = [];
  for (const node of doc.content ?? []) {
    if (node.type !== 'heading') continue;
    const id = typeof node.attrs?.id === 'string' ? node.attrs.id : '';
    // Skip a heading that hasn't been assigned an id yet — HeadingId's
    // onCreate/appendTransaction hooks backfill it within the same tick, so
    // this is only ever visible for a single transient render.
    if (!id) continue;
    const level = typeof node.attrs?.level === 'number' ? node.attrs.level : 1;
    const text = (node.content ?? [])
      .map((child) => (child.type === 'text' ? (child.text ?? '') : ''))
      .join('')
      .trim();
    headings.push({ id, level, text: text || 'Untitled heading' });
  }
  return headings;
}

/**
 * The "Contents" toggle button + dropdown list. Renders nothing until the
 * document has 2+ headings, so a short note never grows an empty/pointless
 * button.
 */
export function TableOfContents({ editor }: { editor: Editor }) {
  const [headings, setHeadings] = useState<HeadingEntry[]>(() => extractHeadings(editor.getJSON()));
  const [open, setOpen] = useState(false);

  // 'update' fires for every transaction that changes the doc — including
  // HeadingId's own auto-assign transaction — so a freshly-typed heading (or
  // a deleted/edited one) is reflected immediately, not just on load.
  useEffect(() => {
    const sync = () => setHeadings(extractHeadings(editor.getJSON()));
    sync();
    editor.on('update', sync);
    return () => {
      editor.off('update', sync);
    };
  }, [editor]);

  // Close the panel if it was open when a note swap remounts this component's
  // parent under a fresh editor instance.
  useEffect(() => () => setOpen(false), [editor]);

  if (headings.length < 2) return null;

  function jumpTo(id: string) {
    const target = editor.view.dom.querySelector<HTMLElement>(`#${CSS.escape(id)}`);
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    target.classList.add('toc-heading-highlight');
    window.setTimeout(() => target.classList.remove('toc-heading-highlight'), 1100);
    setOpen(false);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label="Table of contents"
        title="Contents"
        className={cn(
          'glass-strong flex h-9 items-center gap-1.5 rounded-xl border border-[var(--glass-border)] px-2.5 text-fg-subtle shadow-[0_6px_18px_-10px_rgba(0,0,0,0.5)] transition-colors hover:text-fg sm:px-3',
          open && 'text-fg',
        )}
      >
        <List size={15} />
        <span className="hidden text-xs font-medium sm:inline">Contents</span>
      </button>

      {open && (
        <div
          className="glass-menu absolute right-0 top-11 z-40 flex w-64 flex-col rounded-2xl border border-[var(--glass-border)] shadow-[0_12px_32px_-10px_rgba(0,0,0,0.6)]"
          style={{ maxHeight: '60vh' }}
          role="dialog"
          aria-label="Contents"
        >
          <div className="flex items-center justify-between border-b border-[var(--glass-border)] px-3 py-2">
            <span className="text-xs font-semibold text-fg-muted">Contents</span>
            <button
              type="button"
              aria-label="Close contents"
              onClick={() => setOpen(false)}
              className="grid h-6 w-6 place-items-center rounded-lg text-fg-subtle transition-colors hover:bg-[var(--glass-fill)] hover:text-fg"
            >
              <X size={13} />
            </button>
          </div>
          <ul className="min-h-0 flex-1 overflow-y-auto py-1" role="list">
            {headings.map((heading) => (
              <li key={heading.id}>
                <button
                  type="button"
                  onClick={() => jumpTo(heading.id)}
                  className="block w-full truncate py-1.5 pr-3 text-left text-xs text-fg-muted transition-colors hover:bg-[var(--glass-fill)] hover:text-fg"
                  style={{ paddingLeft: `${0.75 + (Math.max(1, heading.level) - 1) * 0.75}rem` }}
                >
                  {heading.text}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
