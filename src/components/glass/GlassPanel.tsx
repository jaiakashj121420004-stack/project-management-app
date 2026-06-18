import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';
import { accentVars, type AccentName } from '@/lib/accents';

interface GlassPanelProps extends HTMLAttributes<HTMLDivElement> {
  /** Use the heavier glass fill for prominent surfaces. */
  strong?: boolean;
  /** Add a soft accent-colored glow for depth. */
  glow?: boolean;
  /** Wrap in an animated rotating conic gradient border. */
  gradientBorder?: boolean;
  /** Accent that drives the glow / border. Defaults to the inherited accent. */
  accent?: AccentName;
}

/**
 * Frosted glass surface (plan.md §4.2) — the base for most app chrome. Pure CSS,
 * no motion; use GlassCard when you want the pointer tilt.
 */
export function GlassPanel({
  strong = false,
  glow = false,
  gradientBorder = false,
  accent,
  className,
  style,
  children,
  ...rest
}: GlassPanelProps) {
  return (
    <div
      className={cn(
        strong ? 'glass-strong' : 'glass',
        'rounded-3xl',
        gradientBorder && 'gradient-border',
        className,
      )}
      style={{
        ...(accent ? accentVars(accent) : undefined),
        ...(glow ? { boxShadow: 'var(--glass-shadow), 0 24px 60px -28px var(--accent-glow)' } : undefined),
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}
