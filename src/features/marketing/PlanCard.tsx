import { Check } from 'lucide-react';
import { GlassPanel } from '@/components/glass/GlassPanel';
import { cn } from '@/lib/cn';
import { accentVars, type AccentName } from '@/lib/accents';
import type { Plan } from '@/lib/plans';
import { MarketingButton } from './MarketingButton';

interface PlanCardProps {
  plan: Plan;
  accent: AccentName;
  /** Highlight the recommended plan with a gradient border + badge. */
  featured?: boolean;
  ctaLabel: string;
  /** Small print under the CTA (e.g. the Pro upgrade note). */
  note?: string;
}

/**
 * One pricing plan rendered straight from the `PLANS` data (never hardcoded):
 * name, monthly price, tagline, a checklist of `features`, and a CTA to sign up.
 * Shared by the landing pricing teaser and the full pricing page so the two can
 * never drift apart.
 */
export function PlanCard({ plan, accent, featured = false, ctaLabel, note }: PlanCardProps) {
  return (
    <GlassPanel
      strong
      glow={featured}
      gradientBorder={featured}
      accent={accent}
      className={cn('flex h-full flex-col p-6 sm:p-7', featured && 'lg:scale-[1.03]')}
      style={accentVars(accent)}
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-display text-xl font-bold text-fg">{plan.name}</h3>
        {featured && (
          <span className="rounded-full bg-[linear-gradient(110deg,var(--accent-from),var(--accent-to))] px-3 py-1 text-xs font-semibold text-white">
            Most popular
          </span>
        )}
      </div>

      <div className="mt-4 flex items-end gap-1">
        <span className="gradient-text font-display text-4xl font-bold">${plan.priceMonthly}</span>
        <span className="pb-1 text-sm text-fg-muted">/month</span>
      </div>

      <p className="mt-2 text-sm leading-relaxed text-fg-muted">{plan.tagline}</p>

      <ul className="mt-6 flex flex-1 flex-col gap-3">
        {plan.features.map((feature) => (
          <li key={feature} className="flex items-start gap-3 text-sm text-fg">
            <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[linear-gradient(135deg,var(--accent-from),var(--accent-to))] text-white">
              <Check size={12} strokeWidth={3} />
            </span>
            {feature}
          </li>
        ))}
      </ul>

      <div className="mt-7">
        <MarketingButton
          to="/signup"
          variant={featured ? 'primary' : 'secondary'}
          accent={accent}
          fullWidth
        >
          {ctaLabel}
        </MarketingButton>
        {note && <p className="mt-3 text-center text-xs text-fg-subtle">{note}</p>}
      </div>
    </GlassPanel>
  );
}
