import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import { Trash2 } from 'lucide-react';
import { cn } from '@/lib/cn';

const SIZES = [50, 75, 100] as const;

/**
 * Renders an allow-listed audio/video embed in a note. The iframe would swallow
 * clicks needed to select the node, so an overlay captures the click to select
 * when it's NOT selected; once selected, the player is interactive and a toolbar
 * (resize + delete) shows.
 */
export function NoteEmbedView({ node, updateAttributes, deleteNode, selected, editor }: NodeViewProps) {
  const embedUrl = typeof node.attrs.embedUrl === 'string' ? node.attrs.embedUrl : '';
  const kind = node.attrs.kind === 'audio' ? 'audio' : 'video';
  const provider = typeof node.attrs.provider === 'string' ? node.attrs.provider : 'Embed';
  const width = typeof node.attrs.width === 'number' ? node.attrs.width : null;
  const editable = editor.isEditable;

  return (
    <NodeViewWrapper className="note-embed-node" data-drag-handle>
      <div
        contentEditable={false}
        style={{ width: width ? `${width}%` : undefined }}
        className={cn(
          'relative my-2 max-w-full overflow-hidden rounded-xl border',
          selected ? 'border-[var(--accent-from)] ring-1 ring-[var(--accent-from)]' : 'border-[var(--glass-border)]',
        )}
      >
        {embedUrl ? (
          kind === 'audio' ? (
            <iframe
              src={embedUrl}
              title={provider}
              height={166}
              loading="lazy"
              referrerPolicy="strict-origin-when-cross-origin"
              allow="autoplay; encrypted-media"
              className="block w-full"
            />
          ) : (
            <div className="relative w-full" style={{ aspectRatio: '16 / 9' }}>
              <iframe
                src={embedUrl}
                title={provider}
                loading="lazy"
                referrerPolicy="strict-origin-when-cross-origin"
                allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                allowFullScreen
                className="absolute inset-0 h-full w-full"
              />
            </div>
          )
        ) : (
          <div className="p-4 text-sm text-fg-muted">Embed unavailable</div>
        )}

        {/* When not selected, an overlay captures clicks to select the node (so
            the iframe doesn't intercept them). Removed once selected → interactive. */}
        {editable && !selected && <div className="absolute inset-0 z-10 cursor-pointer" aria-hidden />}

        {selected && editable && (
          <div
            className="glass-strong absolute right-2 top-2 z-20 flex items-center gap-0.5 rounded-lg border border-[var(--glass-border)] p-1 shadow-[0_10px_24px_-12px_rgba(0,0,0,0.6)]"
            contentEditable={false}
          >
            <span className="px-1 text-[11px] font-medium text-fg-subtle">{provider}</span>
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
              aria-label="Delete embed"
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
