import { describe, expect, it } from 'vitest';
import { contrastRatio, AA_CONTRAST } from './contrast';
import {
  PERSONALIZATION_PRESETS,
  PERSONALIZATION_PRESET_IDS,
  deriveAccentFromColor,
  isPersonalizationPresetId,
} from './personalizationPresets';

describe('personalization presets clear AA by construction', () => {
  for (const id of PERSONALIZATION_PRESET_IDS) {
    const preset = PERSONALIZATION_PRESETS[id];

    it(`${id} — bg/text clears AA (${AA_CONTRAST}:1)`, () => {
      expect(contrastRatio(preset.bg, preset.text)).toBeGreaterThanOrEqual(AA_CONTRAST);
    });

    it(`${id} — accentFg clears AA on both gradient stops`, () => {
      expect(contrastRatio(preset.accentFrom, preset.accentFg)).toBeGreaterThanOrEqual(
        AA_CONTRAST,
      );
      expect(contrastRatio(preset.accentTo, preset.accentFg)).toBeGreaterThanOrEqual(AA_CONTRAST);
    });

    it(`${id} — accent reads as its own family, distinct from the page ink`, () => {
      // Sanity check against a regression where a "derived" accent silently
      // collapses to near-black/near-white (i.e. stops being a color at all).
      expect(preset.accentFrom.toLowerCase()).not.toBe(preset.text.toLowerCase());
      expect(preset.accentFrom.toLowerCase()).not.toBe(preset.bg.toLowerCase());
    });
  }

  it('every preset id round-trips through isPersonalizationPresetId', () => {
    for (const id of PERSONALIZATION_PRESET_IDS) {
      expect(isPersonalizationPresetId(id)).toBe(true);
    }
    expect(isPersonalizationPresetId('not-a-real-preset')).toBe(false);
  });

  it('has at least six curated presets (a real choice, not a token gesture)', () => {
    expect(PERSONALIZATION_PRESET_IDS.length).toBeGreaterThanOrEqual(6);
  });
});

describe('deriveAccentFromColor always returns an AA-safe, coordinated accent', () => {
  // Including the two confirmed-ugly combos from the bug report — the accent
  // derivation must stay AA-safe even when the user's own bg/text pair is a
  // low-effort raw pick like these.
  const seeds = [
    '#ffc800', // yellow text on black
    '#000000', // black text on red
    '#d33c3c', // saturated red (used as a bg seed elsewhere)
    '#ECE4D6', // the app's own parchment
    '#181210', // the app's own ink
    '#808080', // a fully desaturated grey — must not collapse to no-color
    '#ffffff',
    '#000000',
  ];

  for (const seed of seeds) {
    it(`seed ${seed} → AA-safe accent`, () => {
      const { from, to, fg } = deriveAccentFromColor(seed);
      expect(contrastRatio(from, fg)).toBeGreaterThanOrEqual(AA_CONTRAST);
      expect(contrastRatio(to, fg)).toBeGreaterThanOrEqual(AA_CONTRAST);
    });
  }

  it('is deterministic for the same input', () => {
    expect(deriveAccentFromColor('#3B82F6')).toEqual(deriveAccentFromColor('#3B82F6'));
  });
});
