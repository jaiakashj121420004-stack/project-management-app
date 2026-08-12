import { Sparkles } from 'lucide-react';
import { ENTERPRISE_DISPLAY, PLANS, isProOrAbove, type PlanId } from '@/lib/plans';
import { cn } from '@/lib/cn';

/** A small pill showing the user's plan. Any paid plan gets the flowing accent
 * gradient. 'enterprise' has no `PLANS` entry (no self-serve pricing card), so
 * it falls back to its own label rather than indexing the lookup table. */
export function PlanBadge({ plan, className }: { plan: PlanId; className?: string }) {
  const isPro = isProOrAbove(plan);
  const label = plan === 'enterprise' ? ENTERPRISE_DISPLAY.name : PLANS[plan].name;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold',
        isPro
          ? 'bg-[length:200%_auto] bg-[linear-gradient(110deg,var(--accent-from),var(--accent-to),var(--accent-from))] text-[var(--accent-fg)] shadow-[0_6px_16px_-10px_var(--accent-glow)] motion-safe:animate-gradient-flow'
          : 'border border-[var(--glass-border)] text-fg-muted',
        className,
      )}
    >
      {isPro && <Sparkles size={12} aria-hidden />}
      {label}
    </span>
  );
}
