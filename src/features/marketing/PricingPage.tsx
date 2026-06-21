import { Reveal } from '@/components/motion/Reveal';
import { PLANS, PLAN_ORDER } from '@/lib/plans';
import { MarketingLayout } from './MarketingLayout';
import { PlanCard } from './PlanCard';
import { PricingFaq } from './sections/PricingFaq';

/** Plan-id → accent, CTA copy, and optional small print for the full page. */
const CARD_META = {
  free: { accent: 'lagoon' as const, cta: 'Start free', note: undefined },
  pro: {
    accent: 'bloom' as const,
    cta: 'Go Pro',
    note: 'Upgrade anytime from your account → Billing.',
  },
};

/**
 * The dedicated pricing page: the two plans side-by-side (from `PLANS`) plus a
 * short FAQ. Both cards come from the same `PlanCard`/`PLANS` source as the
 * landing teaser, so the two views can never disagree on price or features.
 */
export function PricingPage() {
  return (
    <MarketingLayout>
      <section className="px-4 pt-12 sm:px-6 sm:pt-16">
        <Reveal className="mx-auto max-w-2xl text-center">
          <h1 className="font-display text-headline font-bold">
            <span className="gradient-text">Pricing that grows with you</span>
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-fg-muted">
            Start free and stay free for as long as you like. Go Pro when you need unlimited projects
            and email reminders.
          </p>
        </Reveal>

        <div className="mx-auto mt-12 grid max-w-3xl items-start gap-5 sm:grid-cols-2">
          {PLAN_ORDER.map((id, i) => (
            <Reveal key={id} delay={i * 0.08}>
              <PlanCard
                plan={PLANS[id]}
                accent={CARD_META[id].accent}
                featured={id === 'pro'}
                ctaLabel={CARD_META[id].cta}
                note={CARD_META[id].note}
              />
            </Reveal>
          ))}
        </div>

        <PricingFaq />
      </section>
    </MarketingLayout>
  );
}
