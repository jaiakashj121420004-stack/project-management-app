import { Reveal } from '@/components/motion/Reveal';
import { ENTERPRISE_CONTACT_EMAIL, PLANS, PLAN_ORDER, TEAM_MEMBER_LIMIT } from '@/lib/plans';
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
  team: {
    accent: 'sunset' as const,
    cta: 'Go Team',
    note: 'Upgrade anytime from your account → Billing.',
  },
};

/**
 * The dedicated pricing page: the three self-serve plans side-by-side (from
 * `PLANS`) plus a short FAQ and a quiet Enterprise contact line. All cards come
 * from the same `PlanCard`/`PLANS` source as the landing teaser, so the two
 * views can never disagree on price or features. Enterprise is intentionally
 * NOT a priced card here — a fourth self-serve tier measurably hurts pricing-
 * page conversion (decision log, memory.md, 2026-08-12); it's a plain "contact
 * us" line instead.
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
            Start free and stay free for as long as you like. Go Pro for unlimited projects and email
            reminders, or Team when your whole class or company needs to be on one board.
          </p>
        </Reveal>

        <div className="mx-auto mt-12 grid max-w-5xl items-start gap-5 sm:grid-cols-3">
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

        <Reveal className="mx-auto mt-6 max-w-5xl text-center text-sm text-fg-muted">
          Need more than {TEAM_MEMBER_LIMIT} people on one board?{' '}
          <a
            href={`mailto:${ENTERPRISE_CONTACT_EMAIL}?subject=Aurora%20Enterprise`}
            className="font-semibold text-[var(--accent-from)] hover:underline"
          >
            Contact us
          </a>{' '}
          about an Enterprise plan.
        </Reveal>

        <PricingFaq />
      </section>
    </MarketingLayout>
  );
}
