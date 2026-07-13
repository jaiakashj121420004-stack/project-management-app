import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  icon: ReactNode;
}

interface SegmentedToggleProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: SegmentOption<T>[];
  /** Accessible name for the group. */
  label: string;
  className?: string;
}

/**
 * A small glass segmented control — the shared Edit/Preview (notes) and
 * Edit/View (canvas) switch. Each option is an icon + label; the active one
 * gets the accent gradient. A pure presentational control (no internal state).
 */
export function SegmentedToggle<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
}: SegmentedToggleProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn(
        'inline-flex items-center gap-1 self-start rounded-xl border border-[var(--glass-border)] p-1',
        className,
      )}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
              active
                ? 'bg-[linear-gradient(110deg,var(--accent-from),var(--accent-to))] text-[var(--accent-fg)]'
                : 'text-fg-muted hover:text-fg',
            )}
          >
            {option.icon}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
