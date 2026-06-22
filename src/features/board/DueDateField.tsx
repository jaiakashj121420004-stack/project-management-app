import { CalendarClock, Clock, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { dueStatus, formatDueLabel } from './due';

interface DueDateFieldProps {
  /** ISO date (YYYY-MM-DD) or null. */
  value: string | null;
  onChange: (value: string | null) => void;
  /** When set, show a companion time picker (Pro — drives cards.due_at). */
  showTime?: boolean;
  /** Local `HH:mm` or null. Only meaningful when `showTime`. */
  time?: string | null;
  onTimeChange?: (time: string | null) => void;
}

const HINT: Record<ReturnType<typeof dueStatus>, string> = {
  overdue: 'text-danger',
  soon: 'text-warning',
  upcoming: 'text-fg-muted',
};

/** Pick a due date (and, for Pro, a time) with a clear button and an
 *  urgency-tinted summary. The values are saved with the card form. */
export function DueDateField({ value, onChange, showTime, time, onTimeChange }: DueDateFieldProps) {
  const status = value ? dueStatus(value) : null;

  return (
    <section aria-label="Due date" className="flex flex-col gap-2">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-fg">
        <CalendarClock size={16} aria-hidden /> Due date
      </h3>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="date"
          value={value ?? ''}
          onChange={(event) => onChange(event.target.value || null)}
          aria-label="Due date"
          className="h-11 min-w-[9rem] flex-1 rounded-2xl border bg-[var(--field-bg)] px-4 text-fg backdrop-blur-sm transition-colors focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--accent-from)] [color-scheme:light_dark]"
        />
        {showTime && (
          <div className="relative flex items-center">
            <Clock
              size={15}
              aria-hidden
              className="pointer-events-none absolute left-3 text-fg-subtle"
            />
            <input
              type="time"
              value={time ?? ''}
              disabled={!value}
              onChange={(event) => onTimeChange?.(event.target.value || null)}
              aria-label="Due time"
              className="h-11 rounded-2xl border bg-[var(--field-bg)] pl-9 pr-3 text-fg backdrop-blur-sm transition-colors focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--accent-from)] disabled:opacity-50 [color-scheme:light_dark]"
            />
          </div>
        )}
        {value && (
          <button
            type="button"
            onClick={() => {
              onChange(null);
              onTimeChange?.(null);
            }}
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
          {showTime && time ? ` · ${time}` : ''}
        </p>
      )}
    </section>
  );
}
