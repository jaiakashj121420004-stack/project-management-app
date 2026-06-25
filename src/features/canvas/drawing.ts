/**
 * drawing.ts — the pen vocabulary for freehand drawing (P3.2).
 *
 * Pure data (React-free): the three pen presets, the colour palette, and the
 * live PenSettings the editor holds. A preset fixes the perfect-freehand feel
 * (thinning/smoothing) and the look (opacity/blend); the size slider and colour
 * swatches layer on top. The highlighter is translucent + multiply, so
 * overlapping ink layers the way a real highlighter does.
 */
import type { Theme } from '@/lib/theme';
import type { StrokeBlend } from './elements';
import type { StrokeStyle } from './freehand';

export type PenPreset = 'pen' | 'marker' | 'highlighter';

export interface PenPresetSpec {
  label: string;
  thinning: number;
  smoothing: number;
  opacity: number;
  blend: StrokeBlend;
  /** Default size + slider range (world px). */
  size: number;
  minSize: number;
  maxSize: number;
}

export const PEN_PRESETS: Record<PenPreset, PenPresetSpec> = {
  pen: {
    label: 'Pen',
    thinning: 0.6,
    smoothing: 0.5,
    opacity: 1,
    blend: 'normal',
    size: 5,
    minSize: 1,
    maxSize: 24,
  },
  marker: {
    label: 'Marker',
    thinning: 0.2,
    smoothing: 0.55,
    opacity: 1,
    blend: 'normal',
    size: 12,
    minSize: 4,
    maxSize: 40,
  },
  highlighter: {
    label: 'Highlighter',
    thinning: 0,
    smoothing: 0.45,
    opacity: 0.35,
    blend: 'multiply',
    size: 24,
    minSize: 10,
    maxSize: 64,
  },
};

/** Presets in display order (toolbar). */
export const PEN_PRESET_ORDER: readonly PenPreset[] = ['pen', 'marker', 'highlighter'];

/**
 * A vivid, theme-agnostic palette that reads on both the light and dark glass
 * canvas. Ink + white anchor the ends so there's always a high-contrast option.
 */
export const PEN_COLORS: readonly string[] = [
  '#0f172a', // ink
  '#ffffff', // white
  '#ef4444', // red
  '#f97316', // orange
  '#fbbf24', // amber
  '#22c55e', // green
  '#14b8a6', // teal
  '#3b82f6', // blue
  '#7c3aed', // violet
  '#ec4899', // pink
];

/** The mutable pen state the editor owns and the pen toolbar edits. */
export interface PenSettings {
  preset: PenPreset;
  color: string;
  size: number;
}

/** The starting pen: a medium pen in a high-contrast ink for the active theme. */
export function defaultPenSettings(theme: Theme): PenSettings {
  return {
    preset: 'pen',
    color: theme === 'dark' ? '#f8fafc' : '#0f172a',
    size: PEN_PRESETS.pen.size,
  };
}

/**
 * Resolve the live pen settings into the full StrokeStyle a stroke commits with.
 * `simulatePressure` comes from the pointer at draw time (true for finger/mouse,
 * false for a real stylus), not the settings.
 */
export function penStrokeStyle(settings: PenSettings, simulatePressure: boolean): StrokeStyle {
  const spec = PEN_PRESETS[settings.preset];
  return {
    color: settings.color,
    size: settings.size,
    thinning: spec.thinning,
    smoothing: spec.smoothing,
    opacity: spec.opacity,
    blend: spec.blend,
    simulatePressure,
  };
}
