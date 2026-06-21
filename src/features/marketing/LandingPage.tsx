import { MarketingLayout } from './MarketingLayout';
import { HeroSection } from './sections/HeroSection';
import { StatBand } from './sections/StatBand';
import { FeaturesSection } from './sections/FeaturesSection';
import { ShowcaseSection } from './sections/ShowcaseSection';
import { PricingTeaser } from './sections/PricingTeaser';
import { TestimonialsSection } from './sections/TestimonialsSection';
import { FinalCtaSection } from './sections/FinalCtaSection';

/**
 * The public landing page — the front door of Aurora. Composes the showcase
 * sections top to bottom; each section owns its own layout and motion so this
 * file stays a thin assembly point.
 */
export function LandingPage() {
  return (
    <MarketingLayout>
      <HeroSection />
      <StatBand />
      <FeaturesSection />
      <ShowcaseSection />
      <PricingTeaser />
      <TestimonialsSection />
      <FinalCtaSection />
    </MarketingLayout>
  );
}
