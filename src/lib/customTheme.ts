/**
 * App-wide personalization: a font pairing (free) plus custom colors (Pro) —
 * either a curated preset or fully custom (Advanced) background/text hex.
 * Everything here writes plain CSS custom properties onto `<html>` as an
 * INLINE style, which cascades over (and can be reset back to) the theme's
 * own `:root`/`.dark`/`.light` values in styles/index.css — so personalizing
 * colors changes `--bg`/`--fg` (+ muted/subtle derivatives), the accent
 * tokens `--accent-from`/`--accent-to`/`--accent-fg`/`--ox`/`--accent-glow`,
 * AND (2026-08-15, bugfix) the glass surface tokens `--glass-fill`/
 * `--glass-fill-strong`/`--glass-border` — those used to stay hard-locked to
 * the active Day/Night theme regardless of any override, which looked fine
 * for a preset roughly as light/dark as the current theme but composited a
 * badly mismatched, low-contrast glass tint whenever they diverged (e.g. a
 * dark preset picked while in Day mode). `.aurora-grain` (the noise texture)
 * still stays theme-driven — it's a decorative overlay, not a color surface
 * text sits on, so it has no contrast implications. That's deliberate: "just
 * a change in color" — now a *coordinated* change in color, so buttons/
 * nav-highlights/links/glass panels all read as intentional against whatever
 * background the user picked, instead of clashing against the leftover brand
 * oxblood or a stale theme-locked glass tint (see personalizationPresets.ts
 * and `deriveAccentFromColor` below).
 *
 * Persisted to localStorage as the instant-paint boot cache (read
 * synchronously before first render, same as the theme toggle — see
 * main.tsx). 2026-08-15: also synced to the account when signed in, via
 * CustomThemeProvider — see that file for the boot-vs-sync split and
 * useProfile.ts / the `custom_theme` column for the server side.
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

/**
 * Coerce an arbitrary value (a `JSON.parse`d localStorage blob, or a jsonb
 * value straight back from Supabase) into a well-formed `CustomThemeSettings`
 * — unknown/missing/bad-shaped fields fall back to the default so a stale or
 * hand-edited value can never crash `applyCustomTheme`.
 */
export function sanitizeCustomTheme(value: unknown): CustomThemeSettings {
  const parsed = (value ?? {}) as Partial<CustomThemeSettings>;
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
}

export function getStoredCustomTheme(): CustomThemeSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CUSTOM_THEME;
    return sanitizeCustomTheme(JSON.parse(raw));
  } catch {
    return DEFAULT_CUSTOM_THEME;
  }
}

/** Deep-equal for two `CustomThemeSettings` — used to avoid a redundant
 *  reconcile/write when the server value already matches what's applied. */
export function customThemeEquals(a: CustomThemeSettings, b: CustomThemeSettings): boolean {
  return (
    a.fontPairing === b.fontPairing && a.preset === b.preset && a.bg === b.bg && a.text === b.text
  );
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

/** Mix ratios (toward bg) for the muted/subtle text tiers derived from a
 *  personalization text color — see the AA-safety comment in
 *  `applyCustomTheme` for how these were chosen. Exported so
 *  `customTheme.test.ts` can assert every curated preset clears AA at BOTH
 *  ratios, not just the primary bg/text pair (`personalizationPresets.test.ts`). */
export const FG_MUTED_RATIO = 0.28;
export const FG_SUBTLE_RATIO = 0.3;

/** Hex-string version of the muted/subtle derivation (same ratios/formula
 *  `applyCustomTheme` writes as CSS vars) — for tests, which compare hex
 *  colors via `contrastRatio`, not the "r g b" channel-string CSS var format. */
export function deriveFgTiers(text: string, bg: string): { muted: string; subtle: string } {
  return {
    muted: mixHexToHex(text, bg, FG_MUTED_RATIO),
    subtle: mixHexToHex(text, bg, FG_SUBTLE_RATIO),
  };
}

/** Like `mixHex`, but returns a `#rrggbb` string instead of an "r g b"
 *  channel triplet — used by `deriveFgTiers` (tests) and internally. */
function mixHexToHex(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  const mix = (x: number, y: number) => Math.round(x + (y - x) * t);
  const toHex2 = (v: number) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0');
  return `#${toHex2(mix(ar, br))}${toHex2(mix(ag, bg))}${toHex2(mix(ab, bb))}`;
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
  '--glass-fill',
  '--glass-fill-strong',
  '--glass-border',
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
    // Ratios (2026-08-15, tightened from 0.28/0.46): 0.46 for subtle let a
    // couple of the 8 curated presets (sage-parchment, terracotta-sun, …) dip
    // to ~3.0:1 against their own flat bg — below the 4.5:1 AA that
    // personalizationPresets.test.ts only ever checked for the primary
    // bg/text pair, never these derived tiers. Verified via a standalone
    // script sweeping every preset: 0.28 already clears AA for muted (worst
    // case ~4.88:1); 0.30 is the first ratio that clears AA for subtle too
    // (worst case ~4.61:1) — kept as close to the original 0.46 as AA allows,
    // rather than over-correcting. Not a hard guarantee for the Advanced
    // (arbitrary hex) path — that already has its own contrast-warning safety
    // net on SettingsPage for the primary pair, same as before.
    const bg = resolved.bg ?? '#808080';
    root.setProperty('--fg-muted', mixHex(resolved.text, bg, FG_MUTED_RATIO));
    root.setProperty('--fg-subtle', mixHex(resolved.text, bg, FG_SUBTLE_RATIO));
  } else {
    root.removeProperty('--fg');
    root.removeProperty('--fg-muted');
    root.removeProperty('--fg-subtle');
  }

  // Coordinated accent — buttons, nav active states, links, the Aurora mark
  // (--ox) and the button glow all move together with the chosen colors
  // instead of staying pinned to the brand oxblood.
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

  // Glass surfaces (2026-08-15 fix): --glass-fill/-strong were previously
  // ALWAYS theme-driven (Night's warm dark brown or Day's cream), regardless
  // of any personalization override. That's fine when the picked bg happens
  // to be roughly the same lightness as the active Day/Night theme, but picks
  // a dark preset (Deep Forest, Plum Study) while in Day mode — or a light
  // preset (Amber Study, Terracotta Sun, …) while in Night mode — composites
  // a wildly mismatched glass tint over the new bg (verified: a light-cream
  // 62%-opacity fill over Deep Forest's near-black bg composites to a muddy
  // mid-gray that --fg-muted/--fg-subtle, AA-verified only against the FLAT
  // bg, fail against by a wide margin — this was the "words not visible" bug).
  // Fix: derive the fill from the resolved bg ITSELF (translucent-over-itself
  // composites back to the same bg color, so the muted/subtle AA verification
  // against the flat bg holds for the actual rendered glass surface too), and
  // the border from the coordinated accent (keeps the existing "tinted edge"
  // character instead of a random leftover oxblood/bone hairline).
  if (resolved?.bg) {
    root.setProperty('--glass-fill', hexToRgba(resolved.bg, 0.55));
    root.setProperty('--glass-fill-strong', hexToRgba(resolved.bg, 0.74));
  } else {
    root.removeProperty('--glass-fill');
    root.removeProperty('--glass-fill-strong');
  }
  if (resolved) {
    root.setProperty('--glass-border', hexToRgba(resolved.accentFrom, 0.32));
  } else {
    root.removeProperty('--glass-border');
  }
}

/** Clear every override back to the active theme's built-in defaults. */
export function resetCustomTheme(): void {
  const root = document.documentElement.style;
  for (const name of VARS) root.removeProperty(name);
  localStorage.removeItem(STORAGE_KEY);
}
