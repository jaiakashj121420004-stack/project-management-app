import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import { ImageOff, Trash2 } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useNoteMediaUrl } from '@/features/notes/noteMedia';

const SIZES = [25, 50, 75, 100] as const;

/** Renders an uploaded note image, resolving its private path to a signed URL.
 *  When selected in an editable note it shows a toolbar to resize (25/50/75/100%)
 *  and delete. */
export function NoteImageView({ node, updateAttributes, deleteNode, selected, editor }: NodeViewProps) {
  const path = typeof node.attrs.path === 'string' ? node.attrs.path : null;
  const alt = typeof node.attrs.alt === 'string' ? node.attrs.alt : '';
  const width = typeof node.attrs.width === 'number' ? node.attrs.width : null;
  const { url, loading, error } = useNoteMediaUrl(path);
  const showTools = selected && editor.isEditable;

  return (
    <NodeViewWrapper className="note-image-node" data-drag-handle>
      <div
        contentEditable={false}
        style={{ width: width ? `${width}%` : undefined }}
        className={cn(
          'relative my-2 max-w-full overflow-hidden rounded-xl border',
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
          <img src={url} alt={alt} className="block max-h-[60vh] w-full object-contain" />
        )}

        {showTools && (
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
        )}
      </div>
    </NodeViewWrapper>
  );
}
