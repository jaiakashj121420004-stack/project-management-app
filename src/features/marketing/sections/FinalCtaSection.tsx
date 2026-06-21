import { ArrowRight } from 'lucide-react';
import { Reveal } from '@/components/motion/Reveal';
import { GlassPanel } from '@/components/glass/GlassPanel';
import { MarketingButton } from '../MarketingButton';

/** Closing call-to-action band that invites the visitor to sign up. */
export function FinalCtaSection() {
  return (
    <section className="px-4 pt-24 sm:px-6">
      <Reveal className="mx-auto max-w-4xl">
        <GlassPanel
          strong
          glow
          gradientBorder
          className="overflow-hidden px-6 py-14 text-center sm:px-12 sm:py-16"
        >
          <h2 className="font-display text-headline font-bold">
            <span className="gradient-text">Start planning in minutes.</span>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg leading-relaxed text-fg-muted">
            Create your first board, invite your team, and watch everything fall into place — free.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <MarketingButton to="/signup" size="lg" leftIcon={<ArrowRight size={18} />}>
              Get started free
            </MarketingButton>
            <MarketingButton to="/pricing" variant="secondary" size="lg">
              See pricing
            </MarketingButton>
          </div>
        </GlassPanel>
      </Reveal>
    </section>
  );
}
