import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Reveal } from '@/components/motion/Reveal';
import { PLANS, PLAN_ORDER } from '@/lib/plans';
import { PlanCard } from '../PlanCard';
import { SectionHeading } from './SectionHeading';

/** Plan-id → accent + CTA copy for the two teaser cards. */
const CARD_META = {
  free: { accent: 'lagoon' as const, cta: 'Start free' },
  pro: { accent: 'bloom' as const, cta: 'Go Pro' },
};

/** Free vs Pro headline cards on the landing page, sourced from `PLANS`. */
export function PricingTeaser() {
  return (
    <section id="pricing" className="scroll-mt-24 px-4 pt-24 sm:px-6">
      <SectionHeading
        eyebrow="Simple pricing"
        title="Start free, upgrade when you grow"
        subtitle="No credit card to begin. Move to Pro any time for unlimited projects and email reminders."
      />

      <div className="mx-auto mt-12 grid max-w-3xl gap-5 sm:grid-cols-2">
        {PLAN_ORDER.map((id, i) => (
          <Reveal key={id} delay={i * 0.08}>
            <PlanCard
              plan={PLANS[id]}
              accent={CARD_META[id].accent}
              featured={id === 'pro'}
              ctaLabel={CARD_META[id].cta}
            />
          </Reveal>
        ))}
      </div>

      <Reveal className="mt-8 text-center">
        <Link
          to="/pricing"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--accent-from)] underline-offset-4 hover:underline"
        >
          Compare plans in detail <ArrowRight size={15} />
        </Link>
      </Reveal>
    </section>
  );
}
