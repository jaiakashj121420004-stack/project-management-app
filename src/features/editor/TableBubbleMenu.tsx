import { useEffect, useState, type ReactNode } from 'react';
import type { Editor } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import {
  ArrowDownToLine,
  ArrowLeftToLine,
  ArrowRightToLine,
  ArrowUpToLine,
  Columns3,
  Rows3,
  Trash2,
} from 'lucide-react';
import { cn } from '@/lib/cn';

interface TableBubbleMenuProps {
  editor: Editor;
}

/**
 * An always-visible mini toolbar that floats directly above/below whichever
 * table cell the caret is in — separate from (and in addition to) the main
 * EditorToolbar's Table popover. That popover only opens once you already
 * know to click the toolbar's table icon a SECOND time while inside a table;
 * user report (2026-08-22) was that add/delete row & column effectively
 * didn't exist because that indirection wasn't discoverable. This menu needs
 * no toolbar round-trip: it appears the moment the caret enters any table
 * cell and disappears the moment it leaves, via Tiptap's own BubbleMenu
 * (`shouldShow` re-runs on every selection change — no stale-`isActive`
 * concerns the way a toolbar button computed once per parent render could
 * have). Notes-only in practice: the Table node is only ever registered via
 * `noteTableExtensions` (see NoteBlockEditor.tsx) — `editor.isActive('table')`
 * is simply always false everywhere else (canvas text boxes, which use a
 * completely separate canvas-element table — see TableGrid.tsx), so mounting
 * this unconditionally in BlockEditor.tsx is safe and needs no extra prop.
 */
export function TableBubbleMenu({ editor }: TableBubbleMenuProps) {
  return (
    <BubbleMenu
      editor={editor}
      pluginKey="tableControls"
      shouldShow={({ editor: e }) => e.isEditable && e.isActive('table')}
      options={{ placement: 'top', offset: 8 }}
      // Appended to <body> (like ToolbarPopover does for the same reason) —
      // the editor's own scroll container is `overflow-y-auto`, which would
      // otherwise clip this menu whenever the table sits near the top edge.
      appendTo={() => document.body}
    >
      <div
        role="toolbar"
        aria-label="Table controls"
        className="glass-strong flex max-w-full flex-wrap items-center gap-1 rounded-xl border border-[var(--glass-border)] p-1.5 shadow-[0_14px_34px_-18px_rgba(0,0,0,0.7)]"
      >
        <Group>
          <Cell label="Add row above" onRun={() => editor.chain().focus().addRowBefore().run()}>
            <ArrowUpToLine size={14} />
          </Cell>
          <Cell label="Add row below" onRun={() => editor.chain().focus().addRowAfter().run()}>
            <ArrowDownToLine size={14} />
          </Cell>
          <Cell label="Delete row" onRun={() => editor.chain().focus().deleteRow().run()}>
            <Rows3 size={14} />
            <Trash2 size={10} className="absolute -bottom-0.5 -right-0.5" />
          </Cell>
        </Group>
        <Divider />
        <Group>
          <Cell label="Add column left" onRun={() => editor.chain().focus().addColumnBefore().run()}>
            <ArrowLeftToLine size={14} />
          </Cell>
          <Cell label="Add column right" onRun={() => editor.chain().focus().addColumnAfter().run()}>
            <ArrowRightToLine size={14} />
          </Cell>
          <Cell label="Delete column" onRun={() => editor.chain().focus().deleteColumn().run()}>
            <Columns3 size={14} />
            <Trash2 size={10} className="absolute -bottom-0.5 -right-0.5" />
          </Cell>
        </Group>
        <Divider />
        <Cell
          label="Toggle header row"
          onRun={() => editor.chain().focus().toggleHeaderRow().run()}
          text="Hdr"
        />
        <Divider />
        <DeleteTableButton editor={editor} />
      </div>
    </BubbleMenu>
  );
}

function Group({ children }: { children: ReactNode }) {
  return <div className="flex items-center gap-0.5">{children}</div>;
}

function Divider() {
  return <span className="mx-0.5 h-5 w-px shrink-0 bg-[var(--glass-border)]" aria-hidden />;
}

function Cell({
  label,
  onRun,
  children,
  text,
}: {
  label: string;
  onRun: () => void;
  children?: ReactNode;
  text?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onRun}
      className="relative grid h-8 min-w-[2rem] shrink-0 place-items-center rounded-lg px-1.5 text-xs font-medium text-fg-muted transition-colors hover:bg-[var(--glass-fill)] hover:text-fg"
    >
      {text ?? children}
    </button>
  );
}

/** Requires a second click within 4s to actually run — a table (unlike a
 *  single row/column) can hold a lot of typed content, and this button sits
 *  right in the flow of editing rather than behind the toolbar's popover, so
 *  it's an easier accidental target. Matches this app's existing convention
 *  for guarding destructive actions close to the content they affect (e.g.
 *  the card timer's inline confirm, the note-image triple-Backspace guard)
 *  without pulling in a separate confirm-chip component for one button. */
function DeleteTableButton({ editor }: { editor: Editor }) {
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!armed) return;
    const id = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(id);
  }, [armed]);

  return (
    <button
      type="button"
      aria-label={armed ? 'Click again to delete the whole table' : 'Delete table'}
      title={armed ? 'Click again to delete the whole table' : 'Delete table'}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => {
        if (armed) {
          editor.chain().focus().deleteTable().run();
          setArmed(false);
        } else {
          setArmed(true);
        }
      }}
      className={cn(
        'grid h-8 shrink-0 place-items-center rounded-lg px-2 text-xs font-medium transition-colors',
        armed
          ? 'bg-danger text-white hover:bg-danger/90'
          : 'text-danger hover:bg-danger/10',
      )}
    >
      <span className="flex items-center gap-1">
        <Trash2 size={14} />
        {armed ? 'Confirm?' : 'Table'}
      </span>
    </button>
  );
}
