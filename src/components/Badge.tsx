import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

type Tone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
  dot?: boolean;
}

const TONES: Record<Tone, string> = {
  neutral: 'bg-[var(--glass-fill)] text-fg-muted border-[var(--glass-border)]',
  accent:
    'text-[var(--accent-fg)] border-transparent bg-[linear-gradient(110deg,var(--accent-from),var(--accent-to))]',
  success: 'bg-success/15 text-success border-success/30',
  warning: 'bg-warning/15 text-warning border-warning/30',
  danger: 'bg-danger/15 text-danger border-danger/30',
  info: 'bg-info/15 text-info border-info/30',
};

const DOT: Record<Tone, string> = {
  neutral: 'bg-fg-subtle',
  accent: 'bg-[var(--accent-fg)]',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  info: 'bg-info',
};

/** Compact status pill — used for labels, due-date urgency, roles, counts. */
export function Badge({ tone = 'neutral', dot = false, className, children, ...rest }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5',
        'text-xs font-medium',
        TONES[tone],
        className,
      )}
      {...rest}
    >
      {dot && <span className={cn('h-1.5 w-1.5 rounded-full', DOT[tone])} />}
      {children}
    </span>
  );
}
