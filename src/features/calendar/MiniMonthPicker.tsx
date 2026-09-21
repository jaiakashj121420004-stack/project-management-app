import { useState } from 'react';
import { addMonths, format, isSameDay, isSameMonth, isToday } from 'date-fns';
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/cn';
import { ToolbarPopover } from '@/components/forms/ToolbarPopover';
import { monthDays, toDateKey, WEEKDAYS } from './dates';

interface MiniMonthPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The Calendar's current period label, e.g. "June 2026" — the trigger's text. */
  label: string;
  /** The Calendar's active cursor date, so the picker opens on the right month. */
  cursor: Date;
  onSelect: (date: Date) => void;
}

/**
 * A small jump-to-date month grid, opened from the toolbar's period label —
 * Outlook's "click the header to jump anywhere" affordance, without adding a
 * permanent side-panel (see the Simplicity Guardrail: no new nav surface for
 * something the Prev/Next/Today buttons already partly cover).
 */
export function MiniMonthPicker({ open, onOpenChange, label, cursor, onSelect }: MiniMonthPickerProps) {
  const [displayMonth, setDisplayMonth] = useState(cursor);
  const days = monthDays(displayMonth);

  function handleOpenChange(next: boolean) {
    if (next) setDisplayMonth(cursor);
    onOpenChange(next);
  }

  function pick(date: Date) {
    onSelect(date);
    onOpenChange(false);
  }

  return (
    <ToolbarPopover
      open={open}
      onClose={() => onOpenChange(false)}
      title="Jump to date"
      trigger={
        <button
          type="button"
          onClick={() => handleOpenChange(!open)}
          aria-haspopup="true"
          aria-expanded={open}
          className="flex items-center gap-1 rounded-lg px-1 -mx-1 text-sm text-fg-muted transition-colors hover:text-fg"
        >
          {label}
          <ChevronDown size={14} />
        </button>
      }
    >
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <button
            type="button"
            aria-label="Previous month"
            onClick={() => setDisplayMonth((d) => addMonths(d, -1))}
            className="grid h-7 w-7 place-items-center rounded-lg text-fg-muted transition-colors hover:bg-[var(--glass-fill)] hover:text-fg"
          >
            <ChevronLeft size={15} />
          </button>
          <span className="text-sm font-semibold text-fg">{format(displayMonth, 'MMMM yyyy')}</span>
          <button
            type="button"
            aria-label="Next month"
            onClick={() => setDisplayMonth((d) => addMonths(d, 1))}
            className="grid h-7 w-7 place-items-center rounded-lg text-fg-muted transition-colors hover:bg-[var(--glass-fill)] hover:text-fg"
          >
            <ChevronRight size={15} />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-0.5">
          {WEEKDAYS.map((wd) => (
            <span key={wd} className="pb-1 text-center text-[0.6rem] font-semibold uppercase text-fg-subtle">
              {wd[0]}
            </span>
          ))}
          {days.map((date) => {
            const key = toDateKey(date);
            const outside = !isSameMonth(date, displayMonth);
            const selected = isSameDay(date, cursor);
            return (
              <button
                key={key}
                type="button"
                onClick={() => pick(date)}
                className={cn(
                  'grid h-7 w-7 place-items-center rounded-lg text-xs font-medium transition-colors',
                  outside && 'text-fg-subtle/50',
                  !outside && !selected && 'text-fg hover:bg-[var(--glass-fill)]',
                  isToday(date) && !selected && 'text-[var(--accent-from)] font-bold',
                  selected &&
                    'bg-[linear-gradient(135deg,var(--accent-from),var(--accent-to))] text-[var(--accent-fg)]',
                )}
              >
                {format(date, 'd')}
              </button>
            );
          })}
        </div>
      </div>
    </ToolbarPopover>
  );
}
