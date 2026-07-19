import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Modal } from '@/components/Modal';
import { GradientButton } from '@/components/buttons/GradientButton';

interface NameDialogProps {
  open: boolean;
  title: string;
  /** Prefilled value (for rename). Empty for create. */
  initialValue?: string;
  /** Placeholder + aria-label for the input. */
  placeholder?: string;
  confirmLabel?: string;
  /** Max length; also enforced by the DB. */
  maxLength?: number;
  onClose: () => void;
  onSubmit: (value: string) => void;
}

/**
 * A minimal single-field dialog used for "New folder" and "Rename". Keeps its own
 * draft, trims on submit, blocks empty values, and autofocuses/selects the input
 * so a rename is instantly editable. The caller owns validation beyond non-empty.
 */
export function NameDialog({
  open,
  title,
  initialValue = '',
  placeholder = 'Name…',
  confirmLabel = 'Save',
  maxLength = 80,
  onClose,
  onSubmit,
}: NameDialogProps) {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  // Re-seed the draft whenever the dialog (re)opens or its prefill changes.
  // Done at render time (React's "adjust state while a prop changes" pattern,
  // tracked with state not a ref) rather than in an effect.
  const [prevOpen, setPrevOpen] = useState(open);
  const [prevInitial, setPrevInitial] = useState(initialValue);
  if (open !== prevOpen || initialValue !== prevInitial) {
    setPrevOpen(open);
    setPrevInitial(initialValue);
    if (open) setValue(initialValue);
  }

  // Focus + select the input shortly after opening (a DOM side-effect only).
  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 20);
    return () => window.clearTimeout(id);
  }, [open]);

  const trimmed = value.trim();

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!trimmed) return;
    onSubmit(trimmed);
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title={title} className="max-w-md">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <input
          ref={inputRef}
          value={value}
          maxLength={maxLength}
          onChange={(event) => setValue(event.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          className="w-full rounded-xl border bg-[var(--field-bg)] px-3.5 py-2.5 text-fg placeholder:text-fg-subtle focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--accent-from)]"
        />
        <div className="flex justify-end gap-2">
          <GradientButton type="button" variant="ghost" onClick={onClose}>
            Cancel
          </GradientButton>
          <GradientButton type="submit" disabled={!trimmed}>
            {confirmLabel}
          </GradientButton>
        </div>
      </form>
    </Modal>
  );
}
