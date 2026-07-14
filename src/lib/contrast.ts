/**
 * WCAG contrast maths (Phase 3, accessibility). Small, dependency-free helpers
 * used to derive text colours that stay legible on the app's tinted pills/badges
 * in BOTH themes, and to prove the derived tokens hit AA (≥ 4.5:1) in tests.
 *
 * All inputs/outputs are `#RRGGBB` hex or `[r, g, b]` 0–255 triplets.
 */
import type { Theme } from '@/lib/theme';

export type Rgb = [number, number, number];

/** `#RGB`/`#RRGGBB` → `[r, g, b]`. Throws on a malformed hex so bugs surface. */
export function hexToRgb(hex: string): Rgb {
  let h = hex.replace('#', '').trim();
  if (h.length === 3) {
    h = h
      .split('')
      .map((c) => c + c)
      .join('');
  }
  if (!/^[0-9a-fA-F]{6}$/.test(h)) {
    throw new Error(`Invalid hex colour: ${hex}`);
  }
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/** `[r, g, b]` → `#RRGGBB` (channels clamped + rounded). */
export function rgbToHex([r, g, b]: Rgb): string {
  const to2 = (v: number) =>
    Math.max(0, Math.min(255, Math.round(v)))
      .toString(16)
      .padStart(2, '0');
  return `#${to2(r)}${to2(g)}${to2(b)}`;
}

/** Linear-light value of one 0–255 channel (WCAG 2.x). */
function linearize(channel: number): number {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** WCAG relative luminance of a colour. */
export function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

/** WCAG contrast ratio between two opaque colours (1 … 21). Order-independent. */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** Linear blend of two hex colours; `t=0` → `a`, `t=1` → `b`. */
export function mix(a: string, b: string, t: number): string {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  return rgbToHex([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t]);
}

/** Composite a semi-transparent `fg` (alpha 0–1) over an opaque `bg`. */
export function compositeOver(fg: string, alpha: number, bg: string): string {
  const F = hexToRgb(fg);
  const B = hexToRgb(bg);
  return rgbToHex([
    F[0] * alpha + B[0] * (1 - alpha),
    F[1] * alpha + B[1] * (1 - alpha),
    F[2] * alpha + B[2] * (1 - alpha),
  ]);
}

/** Opaque theme background a tinted pill composites onto. */
export const THEME_BG: Record<Theme, string> = {
  light: '#ECE4D6', // parchment
  dark: '#181210', // ink
};

/** The alpha of a pill's colour tint (see LabelPill / priority pills). */
export const PILL_TINT_ALPHA = 0.16;

/** AA contrast target for normal-size text. */
export const AA_CONTRAST = 4.5;

/**
 * Derive a legible text colour for a saturated hue rendered on its own tint.
 *
 * The pill fills with `hue` at `PILL_TINT_ALPHA` over the theme background;
 * rendering the raw hue as text on that tint fails AA badly in light mode
 * (audit §1). We darken (light theme) / lighten (dark theme) the hue until it
 * clears AA on the composited tint, preserving the hue's identity where
 * possible and falling back to ink/bone. Deterministic, so it's testable.
 */
export function readableOnTint(hue: string, theme: Theme, alpha: number = PILL_TINT_ALPHA): string {
  const tint = compositeOver(hue, alpha, THEME_BG[theme]);
  const target = theme === 'light' ? '#000000' : '#F4EFE6';
  for (let t = 0; t <= 1.0001; t += 0.05) {
    const candidate = mix(hue, target, t);
    if (contrastRatio(candidate, tint) >= AA_CONTRAST) return candidate;
  }
  return target;
}
