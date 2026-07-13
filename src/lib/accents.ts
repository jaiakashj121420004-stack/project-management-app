import type { CSSProperties } from 'react';

/**
 * Per-project accents, retinted to the Nvexis "Almanac" earth palette
 * (oxblood, gilt, clay, pine, terracotta, umber). Each project picks one; it
 * drives headers, buttons, active states, and card glows. Keys are unchanged
 * from the original Aurora set so existing `projects.accent` values keep
 * working with no migration — only the colours are re-toned onto the brand.
 */
export interface Accent {
  readonly label: string;
  readonly from: string;
  readonly to: string;
  /** Soft colored glow (the "from" hue at low alpha) for layered depth. */
  readonly glow: string;
}

export const ACCENTS = {
  aurora: { label: 'Oxblood', from: '#7A2A26', to: '#9B3A33', glow: 'rgba(122, 42, 38, 0.28)' },
  sunset: { label: 'Gilt', from: '#8A6A2E', to: '#B0863A', glow: 'rgba(138, 106, 46, 0.26)' },
  bloom: { label: 'Clay', from: '#8E4A3C', to: '#A85A48', glow: 'rgba(142, 74, 60, 0.26)' },
  lagoon: { label: 'Pine', from: '#3E5C4B', to: '#4C6B54', glow: 'rgba(62, 92, 75, 0.24)' },
  ember: { label: 'Terracotta', from: '#A0453B', to: '#B85A44', glow: 'rgba(160, 69, 59, 0.28)' },
  galaxy: { label: 'Umber', from: '#5E5346', to: '#7A6A54', glow: 'rgba(94, 83, 70, 0.22)' },
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
