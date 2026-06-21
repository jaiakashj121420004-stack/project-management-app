import type { ReactNode } from 'react';
import { Check } from 'lucide-react';
import { Reveal } from '@/components/motion/Reveal';
import { cn } from '@/lib/cn';
import { FauxCalendar } from '../faux/FauxCalendar';
import { FauxCardDetail } from '../faux/FauxCardDetail';
import { FauxNotes } from '../faux/FauxNotes';
import { SectionHeading } from './SectionHeading';

interface Row {
  eyebrow: string;
  title: string;
  body: string;
  points: string[];
  mock: ReactNode;
  /** Place the mock on the left (visual rhythm); copy goes opposite. */
  reverse: boolean;
}

const ROWS: Row[] = [
  {
    eyebrow: 'Plan ahead',
    title: 'Your whole month, at a glance',
    body: 'Every due date across every project lands on one calendar. Spot crunch weeks early and reschedule with a drag.',
    points: ['All projects in one view', 'Color-coded by project', 'Jump straight to the card'],
    mock: <FauxCalendar />,
    reverse: false,
  },
  {
    eyebrow: 'Go deep',
    title: 'Rich cards that hold the details',
    body: 'Open any card for labels, priority, a due date, an assignee and a checklist that tracks progress as you tick things off.',
    points: ['Checklists with progress', 'Labels & priorities', 'Due dates with reminders'],
    mock: <FauxCardDetail />,
    reverse: true,
  },
  {
    eyebrow: 'Write it down',
    title: 'Notes that live beside the work',
    body: 'Keep plans, specs and meeting notes in markdown — right inside the project, never in another tab.',
    points: ['Full markdown support', 'One doc per project', 'Always in sync'],
    mock: <FauxNotes />,
    reverse: false,
  },
];

/** Alternating copy/mock rows that show real UI surfaces of the app. */
export function ShowcaseSection() {
  return (
    <section id="showcase" className="scroll-mt-24 px-4 pt-24 sm:px-6">
      <SectionHeading
        eyebrow="See it in action"
        title="Designed to feel premium and alive"
        subtitle="Frosted glass, vivid accents and smooth motion on every surface — not a generic dashboard."
      />

      <div className="mx-auto mt-16 flex max-w-6xl flex-col gap-20">
        {ROWS.map((row) => (
          <div
            key={row.title}
            className="grid items-center gap-8 lg:grid-cols-2 lg:gap-14"
          >
            <Reveal className={cn(row.reverse && 'lg:order-2')}>
              <span className="text-sm font-semibold uppercase tracking-wide text-[var(--accent-from)]">
                {row.eyebrow}
              </span>
              <h3 className="mt-3 font-display text-title font-bold text-fg sm:text-3xl">
                {row.title}
              </h3>
              <p className="mt-4 text-lg leading-relaxed text-fg-muted">{row.body}</p>
              <ul className="mt-6 flex flex-col gap-3">
                {row.points.map((point) => (
                  <li key={point} className="flex items-center gap-3 text-fg">
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[linear-gradient(135deg,var(--accent-from),var(--accent-to))] text-white">
                      <Check size={14} strokeWidth={3} />
                    </span>
                    {point}
                  </li>
                ))}
              </ul>
            </Reveal>

            <Reveal delay={0.1} className={cn(row.reverse && 'lg:order-1')}>
              {row.mock}
            </Reveal>
          </div>
        ))}
      </div>
    </section>
  );
}
