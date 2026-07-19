import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import { useNavigate } from 'react-router-dom';
import { ArrowUpRight, Shapes } from 'lucide-react';
import { useNoteRef } from '../noteContext';

/**
 * Renders the embedded canvas card inside a note. Clicking opens the canvas in
 * the Library (via a `?canvas=<id>` param LibraryPage reads). `contentEditable`
 * is off so typing never lands inside the card.
 */
export function CanvasLinkView({ node }: NodeViewProps) {
  const navigate = useNavigate();
  const noteRef = useNoteRef();
  const canvasId = typeof node.attrs.canvasId === 'string' ? node.attrs.canvasId : '';
  const title = typeof node.attrs.title === 'string' && node.attrs.title ? node.attrs.title : 'Canvas';

  const openCanvas = () => {
    if (!canvasId) return;
    const params = new URLSearchParams({ canvas: canvasId });
    // Carry the origin note so the canvas view can offer a "back to note" link.
    if (noteRef) {
      params.set('note', noteRef.noteId);
      params.set('noteTitle', noteRef.noteTitle);
    }
    void navigate(`/library?${params.toString()}`);
  };

  return (
    <NodeViewWrapper className="canvas-link-node">
      <button
        type="button"
        contentEditable={false}
        onClick={openCanvas}
        className="my-1.5 flex w-full items-center gap-3 rounded-xl border border-[var(--glass-border)] bg-[var(--glass-fill)] p-3 text-left transition-colors hover:border-[var(--accent-from)] hover:bg-[var(--accent-from)]/5"
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[var(--accent-from)]/12 text-[var(--accent-from)]">
          <Shapes size={18} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium text-fg">{title}</span>
          <span className="block text-xs text-fg-subtle">Canvas · click to open</span>
        </span>
        <ArrowUpRight size={16} className="shrink-0 text-fg-subtle" />
      </button>
    </NodeViewWrapper>
  );
}
