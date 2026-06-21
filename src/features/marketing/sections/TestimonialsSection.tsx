import { Quote } from 'lucide-react';
import { Reveal } from '@/components/motion/Reveal';
import { GlassPanel } from '@/components/glass/GlassPanel';
import { Avatar } from '@/components/Avatar';
import { accentVars, type AccentName } from '@/lib/accents';
import { SectionHeading } from './SectionHeading';

interface Testimonial {
  quote: string;
  name: string;
  role: string;
  accent: AccentName;
}

// Generic illustrative personas — not real people or public figures.
const TESTIMONIALS: Testimonial[] = [
  {
    quote: 'Aurora replaced three apps for our team. The calendar plus boards combo finally made our deadlines click.',
    name: 'Jordan Avery',
    role: 'Product Lead, a small studio',
    accent: 'aurora',
  },
  {
    quote: 'It’s genuinely the first PM tool I enjoy opening. It looks gorgeous and the reminders mean nothing slips.',
    name: 'Priya Nandakumar',
    role: 'Freelance designer',
    accent: 'bloom',
  },
  {
    quote: 'Set it up in five minutes, invited the team, and we were planning the same afternoon. Offline mode is a lifesaver.',
    name: 'Marco Bianchi',
    role: 'Founder, an early-stage startup',
    accent: 'lagoon',
  },
];

/** Tasteful sample quotes in glass cards (clearly generic personas). */
export function TestimonialsSection() {
  return (
    <section className="px-4 pt-24 sm:px-6">
      <SectionHeading eyebrow="Loved by planners" title="Teams get more done with Aurora" />

      <div className="mx-auto mt-12 grid max-w-6xl gap-5 lg:grid-cols-3">
        {TESTIMONIALS.map((item, i) => (
          <Reveal key={item.name} delay={i * 0.08}>
            <GlassPanel className="flex h-full flex-col p-6" accent={item.accent} style={accentVars(item.accent)}>
              <Quote size={24} className="text-[var(--accent-from)]" aria-hidden />
              <p className="mt-4 flex-1 text-base leading-relaxed text-fg">“{item.quote}”</p>
              <div className="mt-6 flex items-center gap-3">
                <Avatar name={item.name} size={40} />
                <div>
                  <p className="font-display text-sm font-semibold text-fg">{item.name}</p>
                  <p className="text-xs text-fg-muted">{item.role}</p>
                </div>
              </div>
            </GlassPanel>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
