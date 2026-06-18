import { type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { AuroraBackground } from '@/components/AuroraBackground';
import { GlassPanel } from '@/components/glass/GlassPanel';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { Reveal } from '@/components/motion/Reveal';
import { Brand } from '@/components/shell/Brand';
import { cn } from '@/lib/cn';

interface AuthLayoutProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  /** Secondary action below the card, e.g. "Already have an account? Log in". */
  footer?: ReactNode;
}

/** Centered glass card floating on the aurora background — the frame every
 *  auth screen shares. */
export function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  return (
    <div className="relative min-h-dvh">
      <AuroraBackground />

      <div className="absolute right-4 top-4 z-10">
        <ThemeToggle />
      </div>

      <div className="relative z-10 flex min-h-dvh items-center justify-center p-4">
        <Reveal className="w-full max-w-md">
          <GlassPanel strong glow gradientBorder className="p-7 sm:p-9">
            <div className="mb-7 flex flex-col items-center gap-4 text-center">
              <Brand />
              <div>
                <h1 className="gradient-text font-display text-[1.75rem] font-bold leading-tight">
                  {title}
                </h1>
                {subtitle && <p className="mt-2 text-sm text-fg-muted">{subtitle}</p>}
              </div>
            </div>

            {children}

            {footer && <p className="mt-6 text-center text-sm text-fg-muted">{footer}</p>}
          </GlassPanel>
        </Reveal>
      </div>
    </div>
  );
}

/** A labelled "or" rule between the OAuth button and the email form. */
export function OrDivider({ label = 'or' }: { label?: string }) {
  return (
    <div className="my-5 flex items-center gap-3 text-xs font-medium uppercase tracking-wide text-fg-subtle">
      <span className="h-px flex-1 bg-[var(--hairline)]" />
      {label}
      <span className="h-px flex-1 bg-[var(--hairline)]" />
    </div>
  );
}

/** Accent-colored inline link used inside auth copy. */
export function AuthLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className={cn(
        'font-semibold text-[var(--accent-from)] underline-offset-4',
        'transition-opacity hover:underline hover:opacity-90',
      )}
    >
      {children}
    </Link>
  );
}
