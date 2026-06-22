import { CalendarClock } from 'lucide-react';
import { cn } from '@/lib/cn';
import { formatClockTime } from '@/lib/dueAt';
import { DatePicker } from '@/components/forms/DatePicker';
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

/** Pick a due date (and, for Pro, a time) via the on-brand DatePicker, with an
 *  urgency-tinted summary. The values are saved with the card form. */
export function DueDateField({ value, onChange, showTime, time, onTimeChange }: DueDateFieldProps) {
  const status = value ? dueStatus(value) : null;

  return (
    <section aria-label="Due date" className="flex flex-col gap-2">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-fg">
        <CalendarClock size={16} aria-hidden /> Due date
      </h3>
      <DatePicker
        label="Due date"
        placeholder="No due date"
        value={value}
        onChange={onChange}
        showTime={showTime}
        time={time}
        onTimeChange={onTimeChange}
      />
      {status && value && (
        <p className={cn('text-xs font-medium', HINT[status])}>
          {status === 'overdue' ? 'Overdue · ' : status === 'soon' ? 'Due soon · ' : 'Due '}
          {formatDueLabel(value)}
          {showTime && time ? ` · ${formatClockTime(time)}` : ''}
        </p>
      )}
    </section>
  );
}
