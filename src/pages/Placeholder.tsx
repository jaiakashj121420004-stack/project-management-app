import { Construction } from 'lucide-react';
import { GlassPanel } from '@/components/glass/GlassPanel';
import { Reveal } from '@/components/motion/Reveal';

/** Generic "coming in a later phase" screen for routes not yet built. */
export function Placeholder({ title, phase }: { title: string; phase: string }) {
  return (
    <Reveal>
      <GlassPanel
        strong
        glow
        gradientBorder
        className="mx-auto mt-8 flex max-w-xl flex-col items-center gap-4 p-10 text-center"
      >
        <span
          className="grid h-16 w-16 place-items-center rounded-3xl bg-[linear-gradient(135deg,var(--accent-from),var(--accent-to))] text-white shadow-[0_16px_32px_-12px_var(--accent-glow)] ring-1 ring-white/20 motion-safe:animate-float"
          aria-hidden
        >
          <Construction size={28} />
        </span>
        <h1 className="gradient-text font-display text-headline font-bold">{title}</h1>
        <p className="text-fg-muted">
          This view arrives in {phase}. The shell and design system are ready for it.
        </p>
      </GlassPanel>
    </Reveal>
  );
}
