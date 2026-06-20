import { useState, type KeyboardEvent, type ReactNode } from 'react';
import { Flag } from 'lucide-react';
import { cn } from '@/lib/cn';
import { PRIORITY_QUICK, formatPriority, priorityPillClass } from '@/lib/priority';

interface PriorityFieldProps {
  value: number | null;
  onChange: (value: number | null) => void;
}

/**
 * Pick a task priority. P1 is the most urgent; the quick chips cover P1–P10 and
 * "Higher…" reveals a number input for boards big enough to need P11+. Selecting
 * a chip tints it with the same tier color the card face uses.
 */
export function PriorityField({ value, onChange }: PriorityFieldProps) {
  const [customOpen, setCustomOpen] = useState(false);
  const [custom, setCustom] = useState('');

  // A set value above the quick range is shown as its own selected chip.
  const showsCustomChip = value !== null && !PRIORITY_QUICK.includes(value);

  function commitCustom() {
    const n = Number.parseInt(custom, 10);
    if (Number.isFinite(n) && n >= 1) {
      onChange(n);
      setCustom('');
      setCustomOpen(false);
    }
  }

  function handleCustomKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault();
      commitCustom();
    } else if (event.key === 'Escape') {
      setCustom('');
      setCustomOpen(false);
    }
  }

  return (
    <section aria-label="Priority" className="flex flex-col gap-2.5">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-fg">
        <Flag size={16} aria-hidden /> Priority
      </h3>

      <div role="radiogroup" aria-label="Task priority" className="flex flex-wrap items-center gap-1.5">
        <Chip selected={value === null} onClick={() => onChange(null)}>
          None
        </Chip>

        {PRIORITY_QUICK.map((n) => (
          <Chip
            key={n}
            selected={value === n}
            selectedClass={priorityPillClass(n)}
            onClick={() => onChange(n)}
          >
            {formatPriority(n)}
          </Chip>
        ))}

        {showsCustomChip && value !== null && (
          <Chip selected selectedClass={priorityPillClass(value)} onClick={() => onChange(null)}>
            {formatPriority(value)}
          </Chip>
        )}

        {customOpen ? (
          <span className="inline-flex items-center gap-1">
            <span className="text-xs font-medium text-fg-muted">P</span>
            <input
              type="number"
              min={11}
              autoFocus
              value={custom}
              onChange={(event) => setCustom(event.target.value)}
              onKeyDown={handleCustomKeyDown}
              onBlur={commitCustom}
              aria-label="Custom priority number"
              className="h-7 w-16 rounded-lg border bg-[var(--field-bg)] px-2 text-sm text-fg focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--accent-from)]"
            />
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setCustomOpen(true)}
            className="rounded-full border border-dashed border-[var(--glass-border)] px-2.5 py-1 text-xs font-medium text-fg-muted transition-colors hover:bg-[var(--glass-fill)] hover:text-fg"
          >
            Higher…
          </button>
        )}
      </div>
    </section>
  );
}

function Chip({
  selected,
  selectedClass,
  onClick,
  children,
}: {
  selected: boolean;
  selectedClass?: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={cn(
        'rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors',
        selected
          ? (selectedClass ??
            'border-transparent bg-[linear-gradient(110deg,var(--accent-from),var(--accent-to))] text-white')
          : 'border-[var(--glass-border)] text-fg-muted hover:bg-[var(--glass-fill)] hover:text-fg',
      )}
    >
      {children}
    </button>
  );
}
