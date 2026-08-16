import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Modal } from '@/components/Modal';
import { GradientButton } from '@/components/buttons/GradientButton';

interface DeleteCardDialogProps {
  open: boolean;
  onClose: () => void;
  cardTitle: string;
  onConfirm: () => Promise<void>;
  isPending: boolean;
}

/** Confirm before deleting a card, reached from the board tile's hover delete
 *  action (mirrors DeleteColumnDialog) — a quicker path than opening the full
 *  detail modal just to delete. */
export function DeleteCardDialog({ open, onClose, cardTitle, onConfirm, isPending }: DeleteCardDialogProps) {
  const [error, setError] = useState<string | null>(null);

  function handleClose() {
    setError(null);
    onClose();
  }

  async function handleConfirm() {
    setError(null);
    try {
      await onConfirm();
    } catch {
      setError('Could not delete this card. Please try again.');
    }
  }

  return (
    <Modal open={open} onClose={handleClose} accent="ember" title="Delete card">
      <div className="flex items-start gap-3">
        <span
          className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-danger/15 text-danger"
          aria-hidden
        >
          <AlertTriangle size={20} />
        </span>
        <p className="text-fg-muted">
          Delete <span className="font-semibold text-fg">{cardTitle}</span>? This can&apos;t be undone.
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
          Delete card
        </GradientButton>
      </div>
    </Modal>
  );
}
