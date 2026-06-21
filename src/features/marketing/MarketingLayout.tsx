import type { ReactNode } from 'react';
import { AuroraBackground } from '@/components/AuroraBackground';
import { MarketingNav } from './MarketingNav';
import { MarketingFooter } from './MarketingFooter';

/**
 * Shared chrome for every public marketing page: the living aurora backdrop, a
 * sticky frosted nav, the page content, and the footer. Pages pass their
 * sections as `children`; the layout owns nothing page-specific so it stays the
 * single frame the whole public site shares.
 */
export function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-dvh">
      <AuroraBackground />
      <MarketingNav />
      <main className="relative z-10">{children}</main>
      <MarketingFooter />
    </div>
  );
}
