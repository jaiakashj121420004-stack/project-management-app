import { Extension } from '@tiptap/core';
import type { CommandProps } from '@tiptap/core';
import { Selection } from '@tiptap/pm/state';
import type { Node as PMNode } from '@tiptap/pm/model';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    moveBlock: {
      /**
       * Move the top-level block at `pos` (or, if omitted, whichever top-level
       * block contains the current selection) up by one sibling. No-ops
       * (returns false, dispatches nothing) at the first block.
       */
      moveBlockUp: (pos?: number) => ReturnType;
      /** Same as `moveBlockUp`, but down by one sibling. No-ops at the last block. */
      moveBlockDown: (pos?: number) => ReturnType;
    };
  }
}

/** The doc's depth-0 child at `index`, plus its start position. Returns null
 *  past either end so callers can no-op instead of guessing bounds. */
function topLevelBlockAt(doc: PMNode, index: number): { node: PMNode; pos: number } | null {
  if (index < 0 || index >= doc.childCount) return null;
  let pos = 0;
  for (let i = 0; i < index; i += 1) pos += doc.child(i).nodeSize;
  return { node: doc.child(index), pos };
}

/**
 * Swaps the top-level block containing `atPos` (or the current selection)
 * with its previous/next sibling, as ONE transaction — `tr.delete` then
 * `tr.insert` on the same `tr`, dispatched once, so it's a single undo step.
 * `$pos.index(0)` gives the depth-0 sibling index of a position no matter how
 * deep that position itself resolved (inside a paragraph's text, or exactly
 * at a top-level boundary for a NodeSelection like a selected image) — this
 * function only ever moves whole top-level nodes, never reaches inside a list
 * item or table cell.
 */
function moveTopLevelBlock(direction: 'up' | 'down', atPos: number | undefined, props: CommandProps): boolean {
  const { state, dispatch, tr } = props;
  const doc = state.doc;
  const refPos = typeof atPos === 'number' ? atPos : state.selection.$from.pos;
  const clampedRefPos = Math.max(0, Math.min(refPos, doc.content.size));
  const index = doc.resolve(clampedRefPos).index(0);

  const current = topLevelBlockAt(doc, index);
  if (!current) return false;

  const targetIndex = direction === 'up' ? index - 1 : index + 1;
  const target = topLevelBlockAt(doc, targetIndex);
  if (!target) return false; // already first/last — nothing to swap with

  if (!dispatch) return true; // "can I run this" probe — report yes, do nothing

  const currentStart = current.pos;
  const currentEnd = currentStart + current.node.nodeSize;
  const insertPos = direction === 'up' ? target.pos : target.pos + target.node.nodeSize;

  tr.delete(currentStart, currentEnd);
  const mappedInsertPos = tr.mapping.map(insertPos);
  tr.insert(mappedInsertPos, current.node);

  // Keep the selection sensibly anchored on the block that just moved.
  const anchor = Math.min(mappedInsertPos + 1, tr.doc.content.size);
  tr.setSelection(Selection.near(tr.doc.resolve(anchor)));
  tr.scrollIntoView();

  dispatch(tr);
  return true;
}

/**
 * Programmatic + keyboard fallback for block reordering (Improvement Plan
 * Task 31). `blockDragHandle.tsx`'s touch popover and `Mod-Shift-ArrowUp/Down`
 * both call the same `moveBlockUp`/`moveBlockDown` commands defined here, so
 * there's one tested code path for "move a block" regardless of input method.
 * Notes-only — added via NoteBlockEditor's NOTE_EXTENSIONS, never the shared
 * `blockExtensions` canvas text boxes use.
 */
export const MoveBlock = Extension.create({
  name: 'moveBlock',

  addCommands() {
    return {
      moveBlockUp:
        (pos?: number) =>
        (props: CommandProps) =>
          moveTopLevelBlock('up', pos, props),
      moveBlockDown:
        (pos?: number) =>
        (props: CommandProps) =>
          moveTopLevelBlock('down', pos, props),
    };
  },

  addKeyboardShortcuts() {
    return {
      'Mod-Shift-ArrowUp': () => this.editor.commands.moveBlockUp(),
      'Mod-Shift-ArrowDown': () => this.editor.commands.moveBlockDown(),
    };
  },
});
