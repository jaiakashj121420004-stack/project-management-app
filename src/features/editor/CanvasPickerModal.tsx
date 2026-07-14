import { formatDistanceToNow } from 'date-fns';
import { Shapes } from 'lucide-react';
import { Modal } from '@/components/Modal';
import { Spinner } from '@/components/feedback/Spinner';
import { PAGE_LABELS } from '@/lib/canvasPages';
import { useAllCanvases } from '@/features/canvas/useCanvas';

/**
 * Picks one of the user's canvases to embed in a note (Insert canvas). Lists
 * every canvas they can reach; selecting one drops a canvas card into the note.
 */
export function CanvasPickerModal({
  open,
  onClose,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (canvasId: string, title: string) => void;
}) {
  const { data, isLoading } = useAllCanvases();
  const canvases = [...(data ?? [])].sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
  );

  return (
    <Modal open={open} onClose={onClose} title="Insert a canvas" className="max-w-md">
      {isLoading ? (
        <div className="grid place-items-center py-8">
          <Spinner size={24} />
        </div>
      ) : canvases.length === 0 ? (
        <p className="py-2 text-sm text-fg-muted">
          You don’t have any canvases yet — create one in the Library first, then insert it here.
        </p>
      ) : (
        <div className="flex max-h-[55vh] flex-col gap-1 overflow-y-auto">
          {canvases.map((canvas) => (
            <button
              key={canvas.id}
              type="button"
              onClick={() => {
                onSelect(canvas.id, canvas.title);
                onClose();
              }}
              className="flex items-center gap-3 rounded-xl p-2.5 text-left transition-colors hover:bg-[var(--glass-fill)]"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[var(--accent-from)]/12 text-[var(--accent-from)]">
                <Shapes size={18} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-fg">{canvas.title}</span>
                <span className="block truncate text-xs text-fg-subtle">
                  {canvas.projectName ?? 'Personal'} · {PAGE_LABELS[canvas.page_type]} · edited{' '}
                  {formatDistanceToNow(new Date(canvas.updated_at), { addSuffix: true })}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
    </Modal>
  );
}
