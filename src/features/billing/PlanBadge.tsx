import { Sparkles } from 'lucide-react';
import { PLANS, type PlanId } from '@/lib/plans';
import { cn } from '@/lib/cn';

/** A small pill showing the user's plan. Pro gets the flowing accent gradient. */
export function PlanBadge({ plan, className }: { plan: PlanId; className?: string }) {
  const isPro = plan === 'pro';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold',
        isPro
          ? 'bg-[length:200%_auto] bg-[linear-gradient(110deg,var(--accent-from),var(--accent-to),var(--accent-from))] text-white shadow-[0_6px_16px_-10px_var(--accent-glow)] motion-safe:animate-gradient-flow'
          : 'border border-[var(--glass-border)] text-fg-muted',
        className,
      )}
    >
      {isPro && <Sparkles size={12} aria-hidden />}
      {PLANS[plan].name}
    </span>
  );
}
