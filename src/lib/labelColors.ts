/**
 * The label color palette (Phase 5). Labels store a color *name*; the DB
 * constrains it with a CHECK (see the card-details migration), exactly like
 * projects.accent. The UI maps the name to a hex here, so the database stays
 * decoupled from exact swatches. Kept distinct from the six project accents:
 * labels are flat single-hue tags, not gradients.
 */
import { readableOnTint } from '@/lib/contrast';
import type { Theme } from '@/lib/theme';

export interface LabelColorDef {
  readonly label: string;
  readonly hex: string;
}

export const LABEL_COLORS = {
  violet: { label: 'Violet', hex: '#8B5CF6' },
  cyan: { label: 'Cyan', hex: '#06B6D4' },
  emerald: { label: 'Emerald', hex: '#10B981' },
  amber: { label: 'Amber', hex: '#F59E0B' },
  rose: { label: 'Rose', hex: '#F43F5E' },
  pink: { label: 'Pink', hex: '#EC4899' },
  indigo: { label: 'Indigo', hex: '#6366F1' },
  slate: { label: 'Slate', hex: '#64748B' },
} as const satisfies Record<string, LabelColorDef>;

export type LabelColor = keyof typeof LABEL_COLORS;

export const LABEL_COLOR_NAMES = Object.keys(LABEL_COLORS) as LabelColor[];

/** The default color offered when creating a new label. */
export const DEFAULT_LABEL_COLOR: LabelColor = 'violet';

/** Hex for a label color name. */
export function labelHex(color: LabelColor): string {
  return LABEL_COLORS[color].hex;
}

/**
 * A darkened (Day) / lightened (Night) version of the label hue that stays AA
 * legible as *text* on the 16% pill tint — the raw swatch hex fails WCAG badly
 * in light mode (audit §1). Use for pill text; keep the raw hex for the dot.
 */
export function labelTextColor(color: LabelColor, theme: Theme): string {
  return readableOnTint(LABEL_COLORS[color].hex, theme);
}

/** `#RRGGBB` → `rgba(r, g, b, alpha)` for tinted pill fills/borders. */
export function withAlpha(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
