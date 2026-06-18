import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Modal } from '@/components/Modal';
import { GradientButton } from '@/components/buttons/GradientButton';

interface DeleteColumnDialogProps {
  open: boolean;
  onClose: () => void;
  columnName: string;
  cardCount: number;
  onConfirm: () => Promise<void>;
  isPending: boolean;
}

/** Confirm before deleting a column and the cards inside it (cascade). */
export function DeleteColumnDialog({
  open,
  onClose,
  columnName,
  cardCount,
  onConfirm,
  isPending,
}: DeleteColumnDialogProps) {
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
      setError('Could not delete this column. Please try again.');
    }
  }

  return (
    <Modal open={open} onClose={handleClose} accent="ember" title="Delete column">
      <div className="flex items-start gap-3">
        <span
          className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-danger/15 text-danger"
          aria-hidden
        >
          <AlertTriangle size={20} />
        </span>
        <p className="text-fg-muted">
          Delete <span className="font-semibold text-fg">{columnName}</span>
          {cardCount > 0 ? (
            <>
              {' '}
              and its{' '}
              <span className="font-semibold text-fg">
                {cardCount} {cardCount === 1 ? 'card' : 'cards'}
              </span>
            </>
          ) : null}
          ? This can&apos;t be undone.
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
          Delete column
        </GradientButton>
      </div>
    </Modal>
  );
}
