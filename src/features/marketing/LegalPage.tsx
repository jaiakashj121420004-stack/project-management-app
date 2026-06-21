import { AlertTriangle } from 'lucide-react';
import { Reveal } from '@/components/motion/Reveal';
import { GlassPanel } from '@/components/glass/GlassPanel';
import { MarketingLayout } from './MarketingLayout';

export interface LegalSection {
  heading: string;
  /** One or more paragraphs of body copy. */
  body: string[];
}

interface LegalPageProps {
  title: string;
  /** e.g. "June 2026". */
  lastUpdated: string;
  intro: string;
  sections: LegalSection[];
}

/**
 * Shared frame for the Terms and Privacy pages: a readable glass document with
 * a prominent "starter template — have a lawyer review before commercial launch"
 * banner, a last-updated line, an intro, and headed sections. Keeps both legal
 * pages consistent and lean.
 */
export function LegalPage({ title, lastUpdated, intro, sections }: LegalPageProps) {
  return (
    <MarketingLayout>
      <section className="px-4 pt-12 sm:px-6 sm:pt-16">
        <Reveal className="mx-auto max-w-3xl">
          <GlassPanel strong className="p-7 sm:p-10">
            <h1 className="font-display text-headline font-bold">
              <span className="gradient-text">{title}</span>
            </h1>
            <p className="mt-2 text-sm text-fg-subtle">Last updated: {lastUpdated}</p>

            <div className="mt-6 flex items-start gap-3 rounded-2xl border border-warning/30 bg-warning/10 p-4 text-sm text-fg-muted">
              <AlertTriangle size={18} className="mt-0.5 shrink-0 text-warning" />
              <p>
                This is a starter template provided for convenience and is{' '}
                <span className="font-semibold text-fg">not legal advice</span>. Have it reviewed and
                adapted by a qualified lawyer before relying on it for a commercial launch.
              </p>
            </div>

            <p className="mt-6 text-base leading-relaxed text-fg-muted">{intro}</p>

            <div className="mt-8 flex flex-col gap-7">
              {sections.map((section, i) => (
                <div key={section.heading}>
                  <h2 className="font-display text-lg font-semibold text-fg">
                    {i + 1}. {section.heading}
                  </h2>
                  {section.body.map((paragraph, j) => (
                    <p key={j} className="mt-2 text-base leading-relaxed text-fg-muted">
                      {paragraph}
                    </p>
                  ))}
                </div>
              ))}
            </div>
          </GlassPanel>
        </Reveal>
      </section>
    </MarketingLayout>
  );
}
