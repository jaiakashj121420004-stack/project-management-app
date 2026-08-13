import { useState, type KeyboardEvent, type ReactNode } from 'react';
import { Flag } from 'lucide-react';
import { ToolbarPopover } from '@/components/forms/ToolbarPopover';
import { Tooltip } from '@/components/Tooltip';
import { cn } from '@/lib/cn';
import { formatPriority, priorityPillClass } from '@/lib/priority';

interface TodoPriorityPickerProps {
  value: number | null;
  onChange: (value: number | null) => void;
}

/** Quick tiers for a to-do item — smaller range than the card picker (P1–P10)
 *  since a day's list is a handful of items, not a whole board. */
const QUICK = [1, 2, 3, 4, 5];

/**
 * Compact priority picker for a single to-do item, opened from a small flag
 * button on the row. Reuses the same P1…/tier-color convention as card
 * priority (lib/priority.ts) so a P1 looks identical everywhere in the app.
 */
export function TodoPriorityPicker({ value, onChange }: TodoPriorityPickerProps) {
  const [open, setOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [custom, setCustom] = useState('');

  function commitCustom() {
    const n = Number.parseInt(custom, 10);
    if (Number.isFinite(n) && n >= 1) {
      onChange(n);
      setCustom('');
      setCustomOpen(false);
      setOpen(false);
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

  const showsCustomChip = value !== null && !QUICK.includes(value);

  return (
    <ToolbarPopover open={open} onClose={() => setOpen(false)} trigger={
      <Tooltip label={value !== null ? `Priority: ${formatPriority(value)}` : 'Set priority'}>
        <button
          type="button"
          aria-label={value !== null ? `Priority ${formatPriority(value)}` : 'Set priority'}
          onClick={() => setOpen((o) => !o)}
          className={cn(
            'grid h-7 w-7 shrink-0 place-items-center rounded-lg transition-colors',
            value !== null
              ? priorityPillClass(value)
              : 'text-fg-subtle hover:bg-[var(--glass-fill)] hover:text-fg',
          )}
        >
          {value !== null ? (
            <span className="text-[10px] font-bold leading-none">{formatPriority(value)}</span>
          ) : (
            <Flag size={13} />
          )}
        </button>
      </Tooltip>
    }>
      <div className="flex w-56 flex-col gap-2">
        <p className="text-xs font-medium text-fg-muted">Priority</p>
        <div role="radiogroup" aria-label="Item priority" className="flex flex-wrap items-center gap-1.5">
          <Chip selected={value === null} onClick={() => { onChange(null); setOpen(false); }}>
            None
          </Chip>
          {QUICK.map((n) => (
            <Chip
              key={n}
              selected={value === n}
              selectedClass={priorityPillClass(n)}
              onClick={() => { onChange(n); setOpen(false); }}
            >
              {formatPriority(n)}
            </Chip>
          ))}
          {showsCustomChip && value !== null && (
            <Chip selected selectedClass={priorityPillClass(value)} onClick={() => { onChange(null); setOpen(false); }}>
              {formatPriority(value)}
            </Chip>
          )}
          {customOpen ? (
            <span className="inline-flex items-center gap-1">
              <span className="text-xs font-medium text-fg-muted">P</span>
              <input
                type="number"
                min={6}
                autoFocus
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                onKeyDown={handleCustomKeyDown}
                onBlur={commitCustom}
                aria-label="Custom priority number"
                className="h-7 w-14 rounded-lg border bg-[var(--field-bg)] px-2 text-sm text-fg focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--accent-from)]"
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
      </div>
    </ToolbarPopover>
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
            'border-transparent bg-[linear-gradient(110deg,var(--accent-from),var(--accent-to))] text-[var(--accent-fg)]')
          : 'border-[var(--glass-border)] text-fg-muted hover:bg-[var(--glass-fill)] hover:text-fg',
      )}
    >
      {children}
    </button>
  );
}
