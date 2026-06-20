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

/** Tailwind classes for a priority pill, by tier. */
export const PRIORITY_PILL: Record<PriorityTier, string> = {
  critical: 'border-danger/40 bg-danger/15 text-danger',
  high: 'border-[#f97316]/40 bg-[#f97316]/15 text-[#f97316]',
  medium: 'border-warning/40 bg-warning/15 text-warning',
  low: 'border-[#3b82f6]/40 bg-[#3b82f6]/15 text-[#3b82f6]',
  lowest: 'border-[var(--glass-border)] bg-[var(--glass-fill)] text-fg-muted',
};

/** Convenience: classes for a given priority value. */
export function priorityPillClass(value: number): string {
  return PRIORITY_PILL[priorityTier(value)];
}
