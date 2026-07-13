import { Construction } from 'lucide-react';
import { GlassPanel } from '@/components/glass/GlassPanel';
import { Reveal } from '@/components/motion/Reveal';

/** Generic "coming in a later phase" screen for routes not yet built. */
export function Placeholder({ title, phase }: { title: string; phase: string }) {
  return (
    <Reveal>
      <GlassPanel className="mx-auto mt-8 flex max-w-xl flex-col items-center gap-4 p-10 text-center">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-[linear-gradient(135deg,var(--accent-from),var(--accent-to))] text-[var(--accent-fg)] shadow-[0_12px_26px_-12px_var(--accent-glow)]">
          <Construction size={26} />
        </span>
        <h1 className="font-display text-title font-semibold text-fg">{title}</h1>
        <p className="text-fg-muted">This view arrives in {phase}. The shell and design system are ready for it.</p>
      </GlassPanel>
    </Reveal>
  );
}
