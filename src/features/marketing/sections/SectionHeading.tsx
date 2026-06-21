import { Reveal } from '@/components/motion/Reveal';

interface SectionHeadingProps {
  eyebrow: string;
  title: string;
  subtitle?: string;
}

/** Centered eyebrow + gradient headline + optional subtitle, reused per section. */
export function SectionHeading({ eyebrow, title, subtitle }: SectionHeadingProps) {
  return (
    <Reveal className="mx-auto max-w-2xl text-center">
      <span className="text-sm font-semibold uppercase tracking-wide text-[var(--accent-from)]">
        {eyebrow}
      </span>
      <h2 className="mt-3 font-display text-headline font-bold text-fg">{title}</h2>
      {subtitle && <p className="mt-4 text-lg leading-relaxed text-fg-muted">{subtitle}</p>}
    </Reveal>
  );
}
