import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Modal } from '@/components/Modal';
import { GradientButton } from '@/components/buttons/GradientButton';

interface DeleteProjectDialogProps {
  open: boolean;
  onClose: () => void;
  projectName: string;
  onConfirm: () => Promise<void>;
  isPending: boolean;
}

/** Owner-only confirmation before deleting a project (and everything in it). */
export function DeleteProjectDialog({
  open,
  onClose,
  projectName,
  onConfirm,
  isPending,
}: DeleteProjectDialogProps) {
  const [error, setError] = useState<string | null>(null);

  // Clear any prior error as the dialog dismisses, so it never flashes stale on
  // the next open. Every dismissal path (Cancel, backdrop, Esc) routes here.
  function handleClose() {
    setError(null);
    onClose();
  }

  async function handleConfirm() {
    setError(null);
    try {
      await onConfirm();
    } catch {
      setError('Could not delete this project. Please try again.');
    }
  }

  return (
    <Modal open={open} onClose={handleClose} accent="ember" title="Delete project">
      <div className="flex items-start gap-3">
        <span
          className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-danger/15 text-danger"
          aria-hidden
        >
          <AlertTriangle size={20} />
        </span>
        <p className="text-fg-muted">
          Delete <span className="font-semibold text-fg">{projectName}</span>? This permanently
          removes the project and everything inside it. This can&apos;t be undone.
        </p>
      </div>

      {error && (
        <p role="alert" className="mt-4 text-sm text-danger">
          {error}
        </p>
      )}

      <div className="mt-6 flex justify-end gap-2.5">
        <GradientButton type="button" variant="ghost" onClick={handleClose} disabled={isPending}>
          Cancel
        </GradientButton>
        <GradientButton
          type="button"
          accent="ember"
          isLoading={isPending}
          onClick={() => void handleConfirm()}
        >
          Delete project
        </GradientButton>
      </div>
    </Modal>
  );
}
