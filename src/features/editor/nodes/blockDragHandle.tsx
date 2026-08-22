import { useState } from 'react';
import { DragHandle } from '@tiptap/extension-drag-handle-react';
import type { Editor } from '@tiptap/react';
import { GripVertical, ChevronUp, ChevronDown } from 'lucide-react';

/**
 * The notes-only block drag handle (Improvement Plan Task 31). Renders a small
 * grip in the left margin next to the top-level block under the pointer;
 * dragging it reorders that block via `@tiptap/extension-drag-handle-react`
 * (official Tiptap package, MIT, same 3.27.1 release train as the rest of
 * this repo's Tiptap deps — actively maintained, so no custom ProseMirror
 * plugin was needed; see memory.md for the full research note).
 *
 * `nested` is deliberately left at its default `false`: only TOP-LEVEL blocks
 * (a whole paragraph, heading, image, list, table, …) are drag *sources* —
 * grabbing the handle while hovering inside a list or a table cell always
 * targets the WHOLE list/table, never a single list item or cell's content.
 * That matches the task's "reorder top-level blocks" scope exactly and rules
 * out the one truly unsafe case (dragging a block into the middle of a
 * table's cell content) for free, without any drop-position override — see
 * memory.md for the rest of the drop-target reasoning.
 *
 * Touch: native HTML5 drag-and-drop from a touch gesture is unreliable across
 * mobile browsers (notably iOS Safari). Tapping the grip — instead of
 * dragging it — opens a tiny Up/Down popover that calls the exact same
 * `moveBlockUp`/`moveBlockDown` commands (`moveBlock.ts`) the keyboard
 * shortcut uses, so touch has one guaranteed-to-work path independent of
 * native DnD support, on top of whatever native drag the browser also gives it.
 */
export function NoteBlockDragHandle({ editor }: { editor: Editor }) {
  const [pos, setPos] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <DragHandle
      editor={editor}
      className="tiptap-drag-handle"
      onNodeChange={({ node, pos: nodePos }) => {
        setPos(node ? nodePos : null);
        if (!node) setMenuOpen(false);
      }}
    >
      <div className="block-drag-handle">
        <button
          type="button"
          aria-label="Drag to reorder this block, or tap for move up/down"
          className="block-drag-handle__grip"
          onClick={(event) => {
            // A real drag never reaches click (the browser suppresses it once
            // a dragstart fired) — so a click here is always a tap/click, safe
            // to treat as "open the touch fallback menu".
            event.preventDefault();
            event.stopPropagation();
            setMenuOpen((open) => !open);
          }}
        >
          <GripVertical size={14} />
        </button>

        {menuOpen && pos !== null && (
          <div className="block-drag-handle__menu glass-strong" role="group" aria-label="Move block">
            <button
              type="button"
              aria-label="Move block up"
              className="block-drag-handle__menu-btn"
              onClick={() => {
                editor.chain().focus().moveBlockUp(pos).run();
                setMenuOpen(false);
              }}
            >
              <ChevronUp size={14} />
            </button>
            <button
              type="button"
              aria-label="Move block down"
              className="block-drag-handle__menu-btn"
              onClick={() => {
                editor.chain().focus().moveBlockDown(pos).run();
                setMenuOpen(false);
              }}
            >
              <ChevronDown size={14} />
            </button>
          </div>
        )}
      </div>
    </DragHandle>
  );
}
