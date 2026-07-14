import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import { ImageOff, Trash2 } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useNoteMediaUrl } from '@/features/notes/noteMedia';

const SIZES = [25, 50, 75, 100] as const;
const MIN_WIDTH_PCT = 15;

/**
 * Renders an uploaded note image (private path → signed URL). When selected in an
 * editable note it can be resized — either via preset % buttons or by dragging
 * the right-edge handle — and deleted.
 */
export function NoteImageView({ node, updateAttributes, deleteNode, selected, editor }: NodeViewProps) {
  const path = typeof node.attrs.path === 'string' ? node.attrs.path : null;
  const alt = typeof node.attrs.alt === 'string' ? node.attrs.alt : '';
  const width = typeof node.attrs.width === 'number' ? node.attrs.width : null;
  const { url, loading, error } = useNoteMediaUrl(path);
  const showTools = selected && editor.isEditable;

  const containerRef = useRef<HTMLDivElement>(null);
  const dragValueRef = useRef<number | null>(null);
  const [dragWidth, setDragWidth] = useState<number | null>(null);

  const effectiveWidth = dragWidth ?? width;

  function startResize(event: ReactPointerEvent) {
    event.preventDefault();
    event.stopPropagation();
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const parentWidth = container.parentElement?.getBoundingClientRect().width ?? rect.width;

    const onMove = (moveEvent: PointerEvent) => {
      const pct = Math.max(
        MIN_WIDTH_PCT,
        Math.min(100, ((moveEvent.clientX - rect.left) / parentWidth) * 100),
      );
      dragValueRef.current = pct;
      setDragWidth(pct);
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      const final = dragValueRef.current;
      dragValueRef.current = null;
      setDragWidth(null);
      if (final != null) {
        const rounded = Math.round(final);
        updateAttributes({ width: rounded >= 98 ? null : rounded });
      }
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  return (
    <NodeViewWrapper className="note-image-node">
      <div
        ref={containerRef}
        contentEditable={false}
        style={{ width: effectiveWidth ? `${effectiveWidth}%` : undefined }}
        className={cn(
          'relative my-2 max-w-full select-none overflow-hidden rounded-xl border',
          selected ? 'border-[var(--accent-from)] ring-1 ring-[var(--accent-from)]' : 'border-[var(--glass-border)]',
        )}
      >
        {loading ? (
          <div className="grid h-40 place-items-center bg-[var(--glass-fill)] text-xs text-fg-subtle">
            Loading image…
          </div>
        ) : error || !url ? (
          <div className="flex h-40 flex-col items-center justify-center gap-1 bg-[var(--glass-fill)] text-fg-subtle">
            <ImageOff size={20} />
            <span className="text-xs">Image unavailable</span>
          </div>
        ) : (
          <img src={url} alt={alt} draggable={false} className="block max-h-[60vh] w-full object-contain" />
        )}

        {showTools && (
          <>
            {/* Preset sizes + delete */}
            <div
              className="glass-strong absolute right-2 top-2 flex items-center gap-0.5 rounded-lg border border-[var(--glass-border)] p-1 shadow-[0_10px_24px_-12px_rgba(0,0,0,0.6)]"
              contentEditable={false}
            >
              {SIZES.map((size) => {
                const active = width === size || (size === 100 && width === null);
                return (
                  <button
                    key={size}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => updateAttributes({ width: size === 100 ? null : size })}
                    className={cn(
                      'rounded px-1.5 py-0.5 text-[11px] font-medium transition-colors',
                      active
                        ? 'bg-[var(--accent-from)] text-[var(--accent-fg)]'
                        : 'text-fg-muted hover:bg-[var(--glass-fill)] hover:text-fg',
                    )}
                  >
                    {size}%
                  </button>
                );
              })}
              <span className="mx-0.5 h-4 w-px bg-[var(--glass-border)]" />
              <button
                type="button"
                aria-label="Delete image"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => deleteNode()}
                className="grid h-6 w-6 place-items-center rounded text-fg-muted transition-colors hover:bg-danger/10 hover:text-danger"
              >
                <Trash2 size={13} />
              </button>
            </div>

            {/* Drag-to-resize handle — a full-height hit zone on the right edge. */}
            <div
              role="separator"
              aria-label="Drag to resize"
              onPointerDown={startResize}
              onDragStart={(event) => event.preventDefault()}
              className="absolute right-0 top-0 z-20 flex h-full w-6 cursor-ew-resize touch-none items-center justify-end pr-1"
            >
              <span className="h-14 w-1.5 rounded-full bg-[var(--accent-from)] shadow ring-1 ring-white/50" />
            </div>
          </>
        )}
      </div>
    </NodeViewWrapper>
  );
}
