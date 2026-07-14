/**
 * Task priority helpers. Priority is an open-ended positive integer: P1 is the
 * most urgent and there is no upper bound (see the card_priority migration). The
 * card face and picker share this single source of tier colors and labels so a
 * P1 looks the same everywhere.
 */

/** Quick-pick options offered in the picker (P1–P10); higher is typed manually. */
export const PRIORITY_QUICK: number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

/** "P3" etc. */
export function formatPriority(value: number): string {
  return `P${value}`;
}

export type PriorityTier = 'critical' | 'high' | 'medium' | 'low' | 'lowest';

/** Bucket a priority number into a color tier (P1 critical … P6+ lowest). */
export function priorityTier(value: number): PriorityTier {
  if (value <= 1) return 'critical';
  if (value === 2) return 'high';
  if (value === 3) return 'medium';
  if (value <= 5) return 'low';
  return 'lowest';
}

/**
 * Tailwind classes for a priority pill, by tier. Text/fill/border are driven by
 * theme-reactive CSS vars (defined per theme in styles/index.css) whose text
 * tokens are pre-darkened/-lightened to clear WCAG AA (≥ 4.5:1) on the tint in
 * BOTH themes — the old full-saturation hex text (`#f97316`, `#3b82f6`, raw
 * danger/warning) failed contrast (audit §1). `lowest` stays neutral glass.
 */
export const PRIORITY_PILL: Record<PriorityTier, string> = {
  critical:
    'border-[color:var(--prio-crit-line)] bg-[var(--prio-crit-bg)] text-[color:var(--prio-crit-fg)]',
  high: 'border-[color:var(--prio-high-line)] bg-[var(--prio-high-bg)] text-[color:var(--prio-high-fg)]',
  medium: 'border-[color:var(--prio-med-line)] bg-[var(--prio-med-bg)] text-[color:var(--prio-med-fg)]',
  low: 'border-[color:var(--prio-low-line)] bg-[var(--prio-low-bg)] text-[color:var(--prio-low-fg)]',
  lowest: 'border-[var(--glass-border)] bg-[var(--glass-fill)] text-fg-muted',
};

/** Convenience: classes for a given priority value. */
export function priorityPillClass(value: number): string {
  return PRIORITY_PILL[priorityTier(value)];
}
