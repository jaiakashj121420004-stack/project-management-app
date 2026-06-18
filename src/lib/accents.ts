import type { CSSProperties } from 'react';

/**
 * The six Aurora project accent gradients (plan.md §4.2). Each project picks
 * one; it drives headers, buttons, active states, and card glows.
 */
export interface Accent {
  readonly label: string;
  readonly from: string;
  readonly to: string;
  /** Soft colored glow (the "from" hue at low alpha) for layered depth. */
  readonly glow: string;
}

export const ACCENTS = {
  aurora: { label: 'Aurora', from: '#7C3AED', to: '#06B6D4', glow: 'rgba(124, 58, 237, 0.45)' },
  sunset: { label: 'Sunset', from: '#FF6B6B', to: '#FFD93D', glow: 'rgba(255, 107, 107, 0.45)' },
  bloom: { label: 'Bloom', from: '#EC4899', to: '#8B5CF6', glow: 'rgba(236, 72, 153, 0.45)' },
  lagoon: { label: 'Lagoon', from: '#06B6D4', to: '#10B981', glow: 'rgba(6, 182, 212, 0.45)' },
  ember: { label: 'Ember', from: '#F97316', to: '#EF4444', glow: 'rgba(249, 115, 22, 0.45)' },
  galaxy: { label: 'Galaxy', from: '#6366F1', to: '#A855F7', glow: 'rgba(99, 102, 241, 0.45)' },
} as const satisfies Record<string, Accent>;

export type AccentName = keyof typeof ACCENTS;

export const ACCENT_NAMES = Object.keys(ACCENTS) as AccentName[];

/**
 * CSS custom properties for an accent, to spread onto a `style` prop. Anything
 * inside the element then reads `--accent-from`/`--accent-to`/`--accent-glow`.
 */
export function accentVars(name: AccentName): CSSProperties {
  const accent = ACCENTS[name];
  return {
    '--accent-from': accent.from,
    '--accent-to': accent.to,
    '--accent-glow': accent.glow,
  } as CSSProperties;
}

/** A static linear gradient string for an accent (non-animated contexts). */
export function accentGradient(name: AccentName): string {
  const accent = ACCENTS[name];
  return `linear-gradient(110deg, ${accent.from}, ${accent.to})`;
}
