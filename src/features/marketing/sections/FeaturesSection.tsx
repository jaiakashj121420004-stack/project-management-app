import type { LucideIcon } from 'lucide-react';
import {
  Bell,
  CalendarDays,
  Columns3,
  ListChecks,
  Moon,
  NotebookPen,
  Smartphone,
  Users,
} from 'lucide-react';
import { Reveal } from '@/components/motion/Reveal';
import { GlassCard } from '@/components/glass/GlassCard';
import type { AccentName } from '@/lib/accents';
import { SectionHeading } from './SectionHeading';

interface Feature {
  icon: LucideIcon;
  title: string;
  blurb: string;
  accent: AccentName;
}

/** Eight headline features; the six accents are spread across them for variety. */
const FEATURES: Feature[] = [
  {
    icon: Columns3,
    title: 'Kanban boards',
    blurb: 'Drag-and-drop columns and cards with labels, priorities and checklists.',
    accent: 'aurora',
  },
  {
    icon: CalendarDays,
    title: 'Calendar view',
    blurb: 'See everything that’s due on a beautiful month grid, across all projects.',
    accent: 'lagoon',
  },
  {
    icon: ListChecks,
    title: 'Daily to-do planner',
    blurb: 'Plan your day with a focused list that pulls in what matters today.',
    accent: 'sunset',
  },
  {
    icon: NotebookPen,
    title: 'Per-project notes',
    blurb: 'Rich markdown docs that live right next to the work they describe.',
    accent: 'galaxy',
  },
  {
    icon: Users,
    title: 'Real-time collaboration',
    blurb: 'Invite your team with owner, editor and viewer roles — changes sync live.',
    accent: 'bloom',
  },
  {
    icon: Bell,
    title: 'Due-date reminders',
    blurb: 'Never miss a deadline with browser and email reminders before things are due.',
    accent: 'ember',
  },
  {
    icon: Smartphone,
    title: 'Installable PWA',
    blurb: 'Install Aurora on mobile and desktop — fast, app-like, works offline.',
    accent: 'aurora',
  },
  {
    icon: Moon,
    title: 'Light & dark themes',
    blurb: 'Both first-class and luminous. Pick your vibe; it follows you everywhere.',
    accent: 'galaxy',
  },
];

/** Responsive grid of glass feature cards, each with an accent-gradient icon tile. */
export function FeaturesSection() {
  return (
    <section id="features" className="scroll-mt-24 px-4 pt-24 sm:px-6">
      <SectionHeading
        eyebrow="Everything you need"
        title="One workspace for all your work"
        subtitle="Boards, calendar, to-dos, notes and reminders — designed to work together, beautifully."
      />

      <div className="mx-auto mt-12 grid max-w-6xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map((feature, i) => (
          <Reveal key={feature.title} delay={(i % 4) * 0.06}>
            <GlassCard accent={feature.accent} className="h-full p-5">
              <span
                className="grid h-11 w-11 place-items-center rounded-2xl bg-[linear-gradient(135deg,var(--accent-from),var(--accent-to))] text-[var(--accent-fg)] shadow-[0_10px_22px_-10px_var(--accent-glow)]"
                aria-hidden
              >
                <feature.icon size={20} />
              </span>
              <h3 className="mt-4 font-display text-base font-semibold text-fg">{feature.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-fg-muted">{feature.blurb}</p>
            </GlassCard>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
