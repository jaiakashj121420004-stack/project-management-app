/**
 * App-wide personalization: a font pairing (free) plus custom background/text
 * colors (Pro). Everything here writes plain CSS custom properties onto
 * `<html>` as an INLINE style, which cascades over (and can be reset back to)
 * the theme's own `:root`/`.dark`/`.light` values in styles/index.css — so a
 * custom color changes exactly the two color tokens (`--bg`, `--fg`, plus
 * their muted/subtle derivatives) and nothing about the glassmorphism layers
 * (`--glass-fill`/`--glass-border`) or the `.aurora-grain` noise texture,
 * which stay theme-driven. That's deliberate: "just a change in color."
 *
 * Persisted to localStorage only (a per-device preference, like the theme
 * toggle) — not synced across devices via the account.
 */

const STORAGE_KEY = 'aurora-custom-theme';

export type FontPairingId = 'almanac' | 'editorial' | 'modern-serif';

export interface FontPairing {
  label: string;
  description: string;
  display: string;
  body: string;
}

/** Curated, on-brand pairings only — never a free-text font field. The Aurora
 *  "Almanac" identity is a deliberately narrow serif-editorial palette (see
 *  CLAUDE.md design rules: "Never Inter"), so personalization stays inside
 *  that language instead of breaking it. Mono (IBM Plex Mono, figures/eyebrows)
 *  never changes — it's a structural part of the system, not a style choice. */
export const FONT_PAIRINGS: Record<FontPairingId, FontPairing> = {
  almanac: {
    label: 'Almanac (default)',
    description: 'Fraunces + Spectral — the classic Aurora look.',
    display: 'Fraunces',
    body: 'Spectral',
  },
  editorial: {
    label: 'Editorial',
    description: 'Fraunces + Newsreader — a little warmer and more literary.',
    display: 'Fraunces',
    body: 'Newsreader',
  },
  'modern-serif': {
    label: 'Modern Serif',
    description: 'Fraunces + Source Serif 4 — crisper and more contemporary.',
    display: 'Fraunces',
    body: '"Source Serif 4"',
  },
};

export interface CustomThemeSettings {
  fontPairing: FontPairingId;
  /** Hex, e.g. '#ECE4D6', or null to use the active theme's default. */
  bg: string | null;
  /** Hex, or null to use the active theme's default. */
  text: string | null;
}

export const DEFAULT_CUSTOM_THEME: CustomThemeSettings = {
  fontPairing: 'almanac',
  bg: null,
  text: null,
};

export function getStoredCustomTheme(): CustomThemeSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CUSTOM_THEME;
    const parsed = JSON.parse(raw) as Partial<CustomThemeSettings>;
    return {
      fontPairing:
        parsed.fontPairing && parsed.fontPairing in FONT_PAIRINGS
          ? parsed.fontPairing
          : DEFAULT_CUSTOM_THEME.fontPairing,
      bg: typeof parsed.bg === 'string' ? parsed.bg : null,
      text: typeof parsed.text === 'string' ? parsed.text : null,
    };
  } catch {
    return DEFAULT_CUSTOM_THEME;
  }
}

export function storeCustomTheme(settings: CustomThemeSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

/** '#rrggbb' -> [r, g, b] (0-255 each). Falls back to black on a bad hex. */
function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const n = Number.parseInt(clean.length === 3 ? clean.replace(/(.)/g, '$1$1') : clean, 16);
  if (Number.isNaN(n)) return [0, 0, 0];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Linear-interpolate two hex colors; t=0 → a, t=1 → b. Used to derive muted/
 *  subtle text shades from a single custom text color, matching the ~22%/38%
 *  toward-background ratios the built-in themes already use. */
function mixHex(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  const mix = (x: number, y: number) => Math.round(x + (y - x) * t);
  return `${mix(ar, br)} ${mix(ag, bg)} ${mix(ab, bb)}`;
}

function hexToChannels(hex: string): string {
  const [r, g, b] = hexToRgb(hex);
  return `${r} ${g} ${b}`;
}

const VARS = ['--bg', '--fg', '--fg-muted', '--fg-subtle', '--font-display', '--font-body'] as const;

/**
 * Apply a settings object to `<html>` as inline CSS vars. Call this on boot
 * and every time settings change. There is no `isPro` check in here on
 * purpose — the REAL gate is that `SettingsPage` never lets a Free user write
 * a non-null `bg`/`text` into storage in the first place (the color pickers
 * live behind a `<ProGate>`), so nothing free-tier ever reaches this function.
 * A personal color preference has no cost/security surface, unlike the DB-
 * enforced gates elsewhere in the app — this is a pure UX nicety gate.
 */
export function applyCustomTheme(settings: CustomThemeSettings): void {
  const root = document.documentElement.style;

  const pairing = FONT_PAIRINGS[settings.fontPairing] ?? FONT_PAIRINGS.almanac;
  root.setProperty('--font-display', pairing.display);
  root.setProperty('--font-body', pairing.body);

  if (settings.bg) {
    root.setProperty('--bg', hexToChannels(settings.bg));
  } else {
    root.removeProperty('--bg');
  }

  if (settings.text) {
    root.setProperty('--fg', hexToChannels(settings.text));
    // Derive muted/subtle by mixing toward the custom bg (or a neutral grey if
    // no custom bg is set) so text hierarchy still reads correctly.
    const bg = settings.bg ?? '#808080';
    root.setProperty('--fg-muted', mixHex(settings.text, bg, 0.28));
    root.setProperty('--fg-subtle', mixHex(settings.text, bg, 0.46));
  } else {
    root.removeProperty('--fg');
    root.removeProperty('--fg-muted');
    root.removeProperty('--fg-subtle');
  }
}

/** Clear every override back to the active theme's built-in defaults. */
export function resetCustomTheme(): void {
  const root = document.documentElement.style;
  for (const name of VARS) root.removeProperty(name);
  localStorage.removeItem(STORAGE_KEY);
}
