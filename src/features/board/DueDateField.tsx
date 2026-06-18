import { CalendarClock, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { dueStatus, formatDueLabel } from './due';

interface DueDateFieldProps {
  /** ISO date (YYYY-MM-DD) or null. */
  value: string | null;
  onChange: (value: string | null) => void;
}

const HINT: Record<ReturnType<typeof dueStatus>, string> = {
  overdue: 'text-danger',
  soon: 'text-warning',
  upcoming: 'text-fg-muted',
};

/** Pick a due date (native date input, on-brand) with a clear button and an
 *  urgency-tinted summary. The value is saved with the card form. */
export function DueDateField({ value, onChange }: DueDateFieldProps) {
  const status = value ? dueStatus(value) : null;

  return (
    <section aria-label="Due date" className="flex flex-col gap-2">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-fg">
        <CalendarClock size={16} aria-hidden /> Due date
      </h3>
      <div className="flex items-center gap-2">
        <input
          type="date"
          value={value ?? ''}
          onChange={(event) => onChange(event.target.value || null)}
          aria-label="Due date"
          className="h-11 flex-1 rounded-2xl border bg-[var(--field-bg)] px-4 text-fg backdrop-blur-sm transition-colors focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--accent-from)] [color-scheme:light_dark]"
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange(null)}
            aria-label="Clear due date"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-fg-subtle transition-colors hover:bg-[var(--glass-fill)] hover:text-fg"
          >
            <X size={18} />
          </button>
        )}
      </div>
      {status && value && (
        <p className={cn('text-xs font-medium', HINT[status])}>
          {status === 'overdue' ? 'Overdue · ' : status === 'soon' ? 'Due soon · ' : 'Due '}
          {formatDueLabel(value)}
        </p>
      )}
    </section>
  );
}
