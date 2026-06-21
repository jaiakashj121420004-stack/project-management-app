import { Reveal } from '@/components/motion/Reveal';
import { GlassPanel } from '@/components/glass/GlassPanel';
import { FREE_PROJECT_LIMIT } from '@/lib/plans';

interface FaqItem {
  q: string;
  a: string;
}

const FAQ: FaqItem[] = [
  {
    q: 'Can I change plans later?',
    a: 'Yes — upgrade or downgrade any time from your account’s Billing page. Upgrades take effect immediately.',
  },
  {
    q: 'What happens to my projects if I downgrade?',
    a: `Nothing is deleted. If you’re over the Free limit of ${FREE_PROJECT_LIMIT} projects, your existing projects stay fully accessible — you just can’t create new ones until you’re back under the limit or upgrade again.`,
  },
  {
    q: 'Do I need a credit card to start?',
    a: 'No. The Free plan is genuinely free forever and requires no card. You only add payment details when you choose to go Pro.',
  },
  {
    q: 'Is my data secure?',
    a: 'Every project is protected by row-level security, so members only ever see the projects they belong to. See our Privacy Policy for details.',
  },
];

/** Short FAQ accordion-free list for the pricing page. */
export function PricingFaq() {
  return (
    <section className="mx-auto mt-20 max-w-3xl">
      <Reveal>
        <h2 className="text-center font-display text-headline font-bold text-fg">
          Frequently asked questions
        </h2>
      </Reveal>

      <div className="mt-8 flex flex-col gap-4">
        {FAQ.map((item, i) => (
          <Reveal key={item.q} delay={i * 0.05}>
            <GlassPanel className="p-5 sm:p-6">
              <h3 className="font-display text-base font-semibold text-fg">{item.q}</h3>
              <p className="mt-2 text-sm leading-relaxed text-fg-muted">{item.a}</p>
            </GlassPanel>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
