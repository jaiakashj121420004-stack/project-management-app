import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { GitBranch, Shapes } from 'lucide-react';
import { Modal } from '@/components/Modal';
import { Spinner } from '@/components/feedback/Spinner';
import { PAGE_LABELS } from '@/lib/canvasPages';
import { useAllCanvases } from '@/features/canvas/useCanvas';
import { insertIndependentCanvas, patchCanvas } from '@/features/canvas/api';
import { flowchartStarterScene } from '@/features/canvas/flowchartStarter';
import { useIsPro, UpgradeModal } from '@/features/billing';

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
  const isPro = useIsPro();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  /** A new canvas pre-filled with an editable flowchart, dropped straight into the note. */
  async function createFlowchart() {
    if (!isPro) {
      setUpgradeOpen(true);
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const created = await insertIndependentCanvas({ title: 'Flowchart' });
      await patchCanvas(created.id, { scene: flowchartStarterScene() });
      onSelect(created.id, created.title);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the flowchart.');
    } finally {
      setCreating(false);
    }
  }
  const canvases = [...(data ?? [])].sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
  );

  return (
    <Modal open={open} onClose={onClose} title="Insert a canvas" className="max-w-md">
      <button
        type="button"
        disabled={creating}
        onClick={() => void createFlowchart()}
        className="mb-2 flex w-full items-center gap-3 rounded-xl border border-dashed border-[var(--glass-border)] p-2.5 text-left transition-colors hover:bg-[var(--glass-fill)] disabled:opacity-60"
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[var(--accent-from)]/12 text-[var(--accent-from)]">
          {creating ? <Spinner size={16} /> : <GitBranch size={18} />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-medium text-fg">New flowchart</span>
          <span className="block text-xs text-fg-subtle">A starter flow you can edit, with connectors that follow the boxes</span>
        </span>
      </button>
      {error && <p className="mb-2 text-xs text-danger">{error}</p>}
      <UpgradeModal
        open={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        reason="Upgrade to Pro to create flowcharts and canvases."
      />
      {isLoading ? (
        <div className="grid place-items-center py-8">
          <Spinner size={24} />
        </div>
      ) : canvases.length === 0 ? (
        <p className="py-2 text-sm text-fg-muted">
          You don’t have any canvases yet — create one in Notebooks first, then insert it here.
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
