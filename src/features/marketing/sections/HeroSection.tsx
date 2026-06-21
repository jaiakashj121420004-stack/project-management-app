import { ArrowRight, Sparkles } from 'lucide-react';
import { Reveal } from '@/components/motion/Reveal';
import { MarketingButton } from '../MarketingButton';
import { FauxBoard } from '../faux/FauxBoard';

/**
 * The landing hero: an eyebrow pill, a huge gradient headline, a subhead, two
 * CTAs, and the animated faux Kanban board. Stacks to a single column on
 * mobile (copy first, board below) and goes side-by-side on large screens.
 */
export function HeroSection() {
  return (
    <section className="px-4 pt-12 sm:px-6 sm:pt-16 lg:pt-24">
      <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1.05fr_1.25fr] lg:gap-10">
        <Reveal className="text-center lg:text-left">
          <span className="inline-flex items-center gap-2 rounded-full border border-[var(--glass-border)] bg-[var(--glass-fill)] px-3.5 py-1.5 text-xs font-medium text-fg-muted backdrop-blur">
            <Sparkles size={14} className="text-[var(--accent-from)]" />
            Now in public preview
          </span>

          <h1 className="mt-5 font-display text-display font-bold">
            <span className="gradient-text">Project management</span>
            <br />
            that feels like magic.
          </h1>

          <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-fg-muted lg:mx-0">
            Kanban boards, a calendar, daily to-dos, notes and reminders — in one luminous,
            installable app that syncs across every device.
          </p>

          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row lg:items-start">
            <MarketingButton to="/signup" size="lg" leftIcon={<ArrowRight size={18} />}>
              Start free
            </MarketingButton>
            <MarketingButton to="/pricing" variant="secondary" size="lg">
              See pricing
            </MarketingButton>
          </div>

          <p className="mt-4 text-sm text-fg-subtle">No credit card required · Free forever plan</p>
        </Reveal>

        <Reveal delay={0.12}>
          <FauxBoard />
        </Reveal>
      </div>
    </section>
  );
}
