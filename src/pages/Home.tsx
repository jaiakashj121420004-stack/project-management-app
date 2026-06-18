import { ArrowUpRight, Layers } from 'lucide-react';
import { GlassCard } from '@/components/glass/GlassCard';
import { Badge } from '@/components/Badge';
import { Reveal } from '@/components/motion/Reveal';
import { ACCENTS, type AccentName } from '@/lib/accents';

interface SampleProject {
  name: string;
  accent: AccentName;
  cards: number;
  due: number;
}

// Placeholder content until real projects land in Phase 3.
const SAMPLE_PROJECTS: SampleProject[] = [
  { name: 'Product Launch', accent: 'aurora', cards: 24, due: 3 },
  { name: 'Q3 Marketing', accent: 'sunset', cards: 16, due: 1 },
  { name: 'Mobile App', accent: 'bloom', cards: 31, due: 5 },
  { name: 'Research Notes', accent: 'lagoon', cards: 9, due: 0 },
  { name: 'Brand Refresh', accent: 'ember', cards: 12, due: 2 },
  { name: 'Roadmap 2027', accent: 'galaxy', cards: 7, due: 0 },
];

export function Home() {
  return (
    <div className="flex flex-col gap-8">
      <Reveal>
        <header className="pt-2">
          <p className="text-sm font-medium text-fg-muted">Welcome back</p>
          <h1 className="gradient-text mt-1 font-display text-headline font-bold">Your boards</h1>
          <p className="mt-2 max-w-prose text-fg-muted">
            A calm home for every project. Pick a board to dive in — drag, plan, and ship.
          </p>
        </header>
      </Reveal>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {SAMPLE_PROJECTS.map((project, index) => (
          <Reveal key={project.name} delay={index * 0.06}>
            <GlassCard accent={project.accent} className="group h-full p-5">
              <div className="flex items-start justify-between gap-3">
                <span
                  className="grid h-11 w-11 place-items-center rounded-2xl bg-[linear-gradient(135deg,var(--accent-from),var(--accent-to))] text-white shadow-[0_10px_22px_-10px_var(--accent-glow)]"
                  aria-hidden
                >
                  <Layers size={20} />
                </span>
                <ArrowUpRight
                  size={20}
                  className="text-fg-subtle transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-fg"
                />
              </div>

              <h2 className="mt-4 font-display text-lg font-semibold text-fg">{project.name}</h2>
              <p className="mt-1 text-sm text-fg-subtle">{ACCENTS[project.accent].label} accent</p>

              <div className="mt-4 flex items-center gap-2">
                <Badge tone="neutral">{project.cards} cards</Badge>
                {project.due > 0 && (
                  <Badge tone={project.due <= 1 ? 'danger' : 'warning'} dot>
                    {project.due} due soon
                  </Badge>
                )}
              </div>
            </GlassCard>
          </Reveal>
        ))}
      </div>
    </div>
  );
}
