import { useState, type FormEvent, type KeyboardEvent } from 'react';
import { Plus, X } from 'lucide-react';
import { GlassPanel } from '@/components/glass/GlassPanel';
import { columnNameSchema } from './schemas';

interface AddColumnProps {
  onAdd: (name: string) => void;
}

/** Trailing affordance to add a column: a dashed glass tile that expands into a
 *  small composer. Lives outside the columns' SortableContext (not draggable). */
export function AddColumn({ onAdd }: AddColumnProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  function close() {
    setOpen(false);
    setName('');
    setError(null);
  }

  function submit() {
    const parsed = columnNameSchema.safeParse(name);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Invalid name.');
      return;
    }
    onAdd(parsed.data);
    close();
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    submit();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') close();
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-fit w-[16rem] shrink-0 items-center gap-2 rounded-2xl border border-dashed border-[var(--glass-border)] px-4 py-3 text-sm font-medium text-fg-muted transition-colors hover:bg-[var(--glass-fill)] hover:text-fg"
      >
        <Plus size={18} /> Add column
      </button>
    );
  }

  return (
    <GlassPanel strong className="h-fit w-[19rem] shrink-0 p-3">
      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <input
          autoFocus
          value={name}
          maxLength={60}
          placeholder="Column name"
          onChange={(event) => setName(event.target.value)}
          onKeyDown={handleKeyDown}
          aria-label="Column name"
          className="h-9 w-full rounded-xl border bg-[var(--field-bg)] px-3 text-sm font-semibold text-fg placeholder:text-fg-subtle focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--accent-from)]"
        />
        {error && <p className="text-xs text-danger">{error}</p>}
        <div className="flex items-center gap-2">
          <button
            type="submit"
            className="btn-3d inline-flex h-8 items-center gap-1.5 rounded-xl bg-[linear-gradient(110deg,var(--accent-from),var(--accent-to))] px-3 text-sm font-medium text-[var(--accent-fg)]"
          >
            <Plus size={15} /> Add
          </button>
          <button
            type="button"
            onClick={close}
            aria-label="Cancel"
            className="grid h-8 w-8 place-items-center rounded-xl text-fg-subtle hover:bg-[var(--glass-fill)] hover:text-fg"
          >
            <X size={16} />
          </button>
        </div>
      </form>
    </GlassPanel>
  );
}
