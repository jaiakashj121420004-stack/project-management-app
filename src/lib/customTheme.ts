/**
 * App-wide personalization: a font pairing (free) plus custom colors (Pro) —
 * either a curated preset or fully custom (Advanced) background/text hex.
 * Everything here writes plain CSS custom properties onto `<html>` as an
 * INLINE style, which cascades over (and can be reset back to) the theme's
 * own `:root`/`.dark`/`.light` values in styles/index.css — so personalizing
 * colors changes exactly `--bg`/`--fg` (+ muted/subtle derivatives) plus the
 * accent tokens `--accent-from`/`--accent-to`/`--accent-fg`/`--ox`/
 * `--accent-glow`, and nothing about the glassmorphism layers
 * (`--glass-fill`/`--glass-border`) or the `.aurora-grain` noise texture,
 * which stay theme-driven. That's deliberate: "just a change in color" — now
 * a *coordinated* change in color, so buttons/nav-highlights/links read as
 * intentional against whatever background the user picked, instead of
 * clashing against the leftover brand oxblood (see personalizationPresets.ts
 * and `deriveAccentFromColor` below).
 *
 * Persisted to localStorage only (a per-device preference, like the theme
 * toggle) — not synced across devices via the account.
 */
import {
  PERSONALIZATION_PRESETS,
  deriveAccentFromColor,
  isPersonalizationPresetId,
  type PersonalizationPresetId,
} from './personalizationPresets';

const STORAGE_KEY = 'aurora-custom-theme';

export type FontPairingId = 'almanac' | 'modern-sans' | 'mono' | 'bold-editorial' | 'rounded';

export interface FontPairing {
  label: string;
  description: string;
  /** Short eyebrow shown on the picker card, e.g. "Serif" — makes the five
   *  options easy to tell apart at a glance, not just by their sample text. */
  category: string;
  display: string;
  body: string;
}

/** Five deliberately distinct personalization choices — one from each of the
 *  major type families (serif, sans-serif, monospace) plus two further-apart
 *  alternatives, so picking one is an obviously different app, not a subtly
 *  different shade of the same serif. "Almanac" stays the on-brand default;
 *  the rest are free-tier personalization (see SettingsPage), same category
 *  as the custom background/text colors below. Never Inter or Space Grotesk
 *  here — those are the app's own retired identity per CLAUDE.md, not
 *  available as a personalization choice. Mono (IBM Plex Mono used for
 *  figures/eyebrows/kbd) is a separate, fixed structural token — untouched by
 *  this picker even when "Mono" is selected as the display/body pairing. */
export const FONT_PAIRINGS: Record<FontPairingId, FontPairing> = {
  almanac: {
    label: 'Almanac (default)',
    description: 'Fraunces + Spectral — the classic Aurora serif look.',
    category: 'Serif',
    display: 'Fraunces',
    body: 'Spectral',
  },
  'modern-sans': {
    label: 'Modern Sans',
    description: 'Sora + Manrope — clean, geometric, contemporary.',
    category: 'Sans-serif',
    display: 'Sora',
    body: 'Manrope',
  },
  mono: {
    label: 'Mono',
    description: 'IBM Plex Mono throughout — a code-inspired, technical look.',
    category: 'Monospace',
    display: '"IBM Plex Mono"',
    body: '"IBM Plex Mono"',
  },
  'bold-editorial': {
    label: 'Bold Editorial',
    description: 'Playfair Display + Lora — dramatic, high-contrast serif.',
    category: 'Serif',
    display: '"Playfair Display"',
    body: 'Lora',
  },
  rounded: {
    label: 'Rounded',
    description: 'Poppins + Nunito — soft, friendly, and approachable.',
    category: 'Sans-serif',
    display: 'Poppins',
    body: 'Nunito',
  },
};

export interface CustomThemeSettings {
  fontPairing: FontPairingId;
  /**
   * A curated personalization preset (see personalizationPresets.ts), or null
   * to fall back to the Advanced `bg`/`text` pair below. Preset and Advanced
   * are mutually exclusive — picking one clears the other so there's always
   * exactly one source of truth for the active colors.
   */
  preset: PersonalizationPresetId | null;
  /** Advanced: hex, e.g. '#ECE4D6', or null to use the active theme's default. */
  bg: string | null;
  /** Advanced: hex, or null to use the active theme's default. */
  text: string | null;
}

export const DEFAULT_CUSTOM_THEME: CustomThemeSettings = {
  fontPairing: 'almanac',
  preset: null,
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
      preset:
        typeof parsed.preset === 'string' && isPersonalizationPresetId(parsed.preset)
          ? parsed.preset
          : null,
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

/** `rgba(r, g, b, alpha)` from a hex color — for the derived `--accent-glow`. */
function hexToRgba(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const VARS = [
  '--bg',
  '--fg',
  '--fg-muted',
  '--fg-subtle',
  '--font-display',
  '--font-body',
  '--accent-from',
  '--accent-to',
  '--accent-fg',
  '--accent-glow',
  '--ox',
] as const;

interface ResolvedPersonalization {
  bg: string | null;
  text: string | null;
  accentFrom: string;
  accentTo: string;
  accentFg: string;
}

/**
 * Resolve the active preset (or Advanced bg/text pair) into the concrete
 * colors `applyCustomTheme` writes to `<html>`. Returns null when nothing is
 * customized (default Almanac colors, theme-driven as usual).
 *
 * A preset's accent ships pre-derived (personalizationPresets.ts). An
 * Advanced pair derives its accent live via `deriveAccentFromColor`, seeded
 * from whichever of text/bg the user actually set (text preferred — it's
 * usually the more deliberate, saturated pick) — so even a fully custom
 * background/text combo gets a coordinated button/highlight color instead of
 * leaving the brand's oxblood clashing against it.
 */
function resolvePersonalization(settings: CustomThemeSettings): ResolvedPersonalization | null {
  if (settings.preset) {
    const preset = PERSONALIZATION_PRESETS[settings.preset];
    return {
      bg: preset.bg,
      text: preset.text,
      accentFrom: preset.accentFrom,
      accentTo: preset.accentTo,
      accentFg: preset.accentFg,
    };
  }
  if (settings.bg || settings.text) {
    const seed = settings.text ?? settings.bg ?? '#7A2A26';
    const accent = deriveAccentFromColor(seed);
    return {
      bg: settings.bg,
      text: settings.text,
      accentFrom: accent.from,
      accentTo: accent.to,
      accentFg: accent.fg,
    };
  }
  return null;
}

/**
 * Apply a settings object to `<html>` as inline CSS vars. Call this on boot
 * and every time settings change. There is no `isPro` check in here on
 * purpose — the REAL gate is that `SettingsPage` never lets a Free user write
 * a non-null `preset`/`bg`/`text` into storage in the first place (the preset
 * grid and the Advanced color pickers both live behind a `<ProGate>`), so
 * nothing free-tier ever reaches this function. A personal color preference
 * has no cost/security surface, unlike the DB-enforced gates elsewhere in the
 * app — this is a pure UX nicety gate.
 */
export function applyCustomTheme(settings: CustomThemeSettings): void {
  const root = document.documentElement.style;

  const pairing = FONT_PAIRINGS[settings.fontPairing] ?? FONT_PAIRINGS.almanac;
  root.setProperty('--font-display', pairing.display);
  root.setProperty('--font-body', pairing.body);

  const resolved = resolvePersonalization(settings);

  if (resolved?.bg) {
    root.setProperty('--bg', hexToChannels(resolved.bg));
  } else {
    root.removeProperty('--bg');
  }

  if (resolved?.text) {
    root.setProperty('--fg', hexToChannels(resolved.text));
    // Derive muted/subtle by mixing toward the resolved bg (or a neutral grey
    // if no bg override is active) so text hierarchy still reads correctly.
    const bg = resolved.bg ?? '#808080';
    root.setProperty('--fg-muted', mixHex(resolved.text, bg, 0.28));
    root.setProperty('--fg-subtle', mixHex(resolved.text, bg, 0.46));
  } else {
    root.removeProperty('--fg');
    root.removeProperty('--fg-muted');
    root.removeProperty('--fg-subtle');
  }

  // Coordinated accent — buttons, nav active states, links, the Aurora mark
  // (--ox) and the button glow all move together with the chosen colors
  // instead of staying pinned to the brand oxblood. Untouched:
  // --glass-fill/--glass-border/.aurora-grain (glass + grain stay exactly the
  // same — only the color underneath changes).
  if (resolved) {
    root.setProperty('--accent-from', resolved.accentFrom);
    root.setProperty('--accent-to', resolved.accentTo);
    root.setProperty('--accent-fg', resolved.accentFg);
    root.setProperty('--accent-glow', hexToRgba(resolved.accentFrom, 0.26));
    root.setProperty('--ox', resolved.accentFrom);
  } else {
    root.removeProperty('--accent-from');
    root.removeProperty('--accent-to');
    root.removeProperty('--accent-fg');
    root.removeProperty('--accent-glow');
    root.removeProperty('--ox');
  }
}

/** Clear every override back to the active theme's built-in defaults. */
export function resetCustomTheme(): void {
  const root = document.documentElement.style;
  for (const name of VARS) root.removeProperty(name);
  localStorage.removeItem(STORAGE_KEY);
}
