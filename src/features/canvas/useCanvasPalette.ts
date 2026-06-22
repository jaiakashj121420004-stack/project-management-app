import { useLayoutEffect, useState, type RefObject } from 'react';
import { useTheme } from '@/hooks/useTheme';

/**
 * Konva draws to a raw canvas and can't read CSS variables, so we resolve the
 * Aurora tokens to concrete color strings once per theme. We read from the stage
 * CONTAINER (not <html>) so the project's accent — set via accentVars() on a
 * wrapper — is in scope. Recomputed whenever the theme flips (light ⇆ dark).
 */
export interface CanvasPalette {
  /** Foreground ink at an arbitrary alpha (for grid lines, dots, labels). */
  ink: (alpha: number) => string;
  /** Project accent (`--accent-from`), e.g. selection + active affordances. */
  accent: string;
  /** Faint ruled/grid line color. */
  gridLine: string;
  /** Slightly stronger dot color for the dotted page. */
  gridDot: string;
  /** Glass-like fill for stub element surfaces. */
  surface: string;
  /** Subtle border for stub element surfaces. */
  border: string;
  /** Strong ink for element text. */
  text: string;
  /** Muted ink for placeholder hints. */
  muted: string;
}

function parseTriplet(value: string): [number, number, number] {
  const parts = value
    .trim()
    .split(/[\s,]+/)
    .map(Number)
    .filter((n) => Number.isFinite(n));
  return parts.length >= 3 ? [parts[0]!, parts[1]!, parts[2]!] : [128, 128, 128];
}

function buildPalette(fgVar: string, accentVar: string): CanvasPalette {
  const [r, g, b] = parseTriplet(fgVar);
  const ink = (alpha: number) => `rgba(${r}, ${g}, ${b}, ${alpha})`;
  const accent = accentVar.trim() || '#7c3aed';
  return {
    ink,
    accent,
    gridLine: ink(0.12),
    gridDot: ink(0.24),
    surface: ink(0.05),
    border: ink(0.16),
    text: ink(0.92),
    muted: ink(0.5),
  };
}

const FALLBACK = buildPalette('128 128 128', '#7c3aed');

export function useCanvasPalette(containerRef: RefObject<HTMLElement | null>): CanvasPalette {
  // Re-read the resolved tokens whenever the theme changes.
  const { theme } = useTheme();
  const [palette, setPalette] = useState<CanvasPalette>(FALLBACK);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const styles = getComputedStyle(el);
    setPalette(
      buildPalette(styles.getPropertyValue('--fg'), styles.getPropertyValue('--accent-from')),
    );
  }, [containerRef, theme]);

  return palette;
}
