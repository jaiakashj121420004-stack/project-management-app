import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import { ImageOff } from 'lucide-react';
import { useNoteMediaUrl } from '@/features/notes/noteMedia';

/** Renders an uploaded note image, resolving its private path to a signed URL. */
export function NoteImageView({ node, selected }: NodeViewProps) {
  const path = typeof node.attrs.path === 'string' ? node.attrs.path : null;
  const alt = typeof node.attrs.alt === 'string' ? node.attrs.alt : '';
  const { url, loading, error } = useNoteMediaUrl(path);

  return (
    <NodeViewWrapper className="note-image-node" data-drag-handle>
      <div
        contentEditable={false}
        className={`my-2 overflow-hidden rounded-xl border ${
          selected ? 'border-[var(--accent-from)]' : 'border-[var(--glass-border)]'
        }`}
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
      </div>
    </NodeViewWrapper>
  );
}
