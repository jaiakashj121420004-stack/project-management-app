/**
 * color.ts — small colour conversions for the canvas colour picker.
 *
 * Pure, dependency-free HSV ⇄ RGB ⇄ hex helpers + a tiny localStorage-backed
 * "recent custom colours" list. The picker works in HSV (a saturation/value
 * square + a hue slider read naturally), but everything persists as hex strings
 * (what strokes + Tiptap `setColor` expect).
 */

export interface Hsv {
  /** 0–360 */ h: number;
  /** 0–1 */ s: number;
  /** 0–1 */ v: number;
}

/** Clamp to [min, max]. */
function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/** Normalise any accepted hex (#rgb / #rrggbb, with or without #) to #rrggbb, or null. */
export function normalizeHex(input: string): string | null {
  let hex = input.trim().replace(/^#/, '').toLowerCase();
  if (/^[0-9a-f]{3}$/.test(hex)) {
    hex = hex.split('').map((c) => c + c).join('');
  }
  return /^[0-9a-f]{6}$/.test(hex) ? `#${hex}` : null;
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const normal = normalizeHex(hex);
  if (!normal) return null;
  return {
    r: parseInt(normal.slice(1, 3), 16),
    g: parseInt(normal.slice(3, 5), 16),
    b: parseInt(normal.slice(5, 7), 16),
  };
}

export function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function hsvToRgb({ h, s, v }: Hsv): { r: number; g: number; b: number } {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r: number;
  let g: number;
  let b: number;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 };
}

export function rgbToHsv(r: number, g: number, b: number): Hsv {
  const rr = r / 255;
  const gg = g / 255;
  const bb = b / 255;
  const max = Math.max(rr, gg, bb);
  const min = Math.min(rr, gg, bb);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === rr) h = ((gg - bb) / d) % 6;
    else if (max === gg) h = (bb - rr) / d + 2;
    else h = (rr - gg) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const s = max === 0 ? 0 : d / max;
  return { h, s, v: max };
}

export function hsvToHex(hsv: Hsv): string {
  const { r, g, b } = hsvToRgb(hsv);
  return rgbToHex(r, g, b);
}

export function hexToHsv(hex: string): Hsv | null {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  return rgbToHsv(rgb.r, rgb.g, rgb.b);
}

// ── recent custom colours (localStorage) ─────────────────────────────────────

const RECENT_KEY = 'aurora.canvas.recentColors';
const RECENT_MAX = 8;

export function getRecentColors(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as unknown;
    return Array.isArray(list) ? list.filter((c): c is string => typeof c === 'string') : [];
  } catch {
    return [];
  }
}

/** Push a colour to the front of the recents (deduped, capped). Returns the new list. */
export function pushRecentColor(hex: string): string[] {
  const normal = normalizeHex(hex);
  if (!normal) return getRecentColors();
  const next = [normal, ...getRecentColors().filter((c) => c !== normal)].slice(0, RECENT_MAX);
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // ignore quota / private-mode errors — recents are a nicety, not critical.
  }
  return next;
}
