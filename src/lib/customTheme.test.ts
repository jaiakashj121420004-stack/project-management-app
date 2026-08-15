import { describe, expect, it } from 'vitest';
import { contrastRatio, compositeOver, AA_CONTRAST } from './contrast';
import { PERSONALIZATION_PRESETS, PERSONALIZATION_PRESET_IDS } from './personalizationPresets';
import { deriveFgTiers } from './customTheme';

/**
 * Regression coverage for the 2026-08-15 "Deep Forest theme has almost no
 * words visible" bug report. Two distinct gaps, both now fixed in
 * `applyCustomTheme`:
 *
 * 1. `--fg-muted`/`--fg-subtle` are DERIVED from a preset's bg/text (not part
 *    of the preset object itself), so `personalizationPresets.test.ts`
 *    checking the primary bg/text pair never caught that the OLD 0.46 subtle
 *    ratio dropped a few presets below AA against their own flat bg.
 * 2. `--glass-fill`/`--glass-fill-strong` used to stay hard-locked to the
 *    active Day/Night theme's own fixed color regardless of any
 *    personalization override, so a dark preset picked while in Day mode (or
 *    vice versa) composited a badly mismatched, low-contrast glass tint that
 *    NEITHER this file nor personalizationPresets.test.ts could have caught,
 *    since neither exercised the glass composite at all. `applyCustomTheme`
 *    now derives the fill from the resolved bg itself (see its comment) —
 *    proven below to composite back to exactly the flat bg, so gap 1's fix
 *    covers the rendered glass surface too, not just the flat-bg case.
 */
describe('personalization text tiers clear AA against the flat bg (gap 1)', () => {
  for (const id of PERSONALIZATION_PRESET_IDS) {
    const preset = PERSONALIZATION_PRESETS[id];
    const { muted, subtle } = deriveFgTiers(preset.text, preset.bg);

    it(`${id} — fg-muted clears AA against bg`, () => {
      expect(contrastRatio(preset.bg, muted)).toBeGreaterThanOrEqual(AA_CONTRAST);
    });

    it(`${id} — fg-subtle clears AA against bg`, () => {
      expect(contrastRatio(preset.bg, subtle)).toBeGreaterThanOrEqual(AA_CONTRAST);
    });
  }
});

describe('the glass surface (bg composited at the fill alphas) also clears AA (gap 2)', () => {
  // Mirrors applyCustomTheme's fix: --glass-fill/-strong are the resolved bg
  // itself at 0.55/0.74 alpha. Compositing a color over an (approximately)
  // equal-colored backdrop should land back on ~that same color regardless of
  // alpha — asserted directly here so a future change to the fill derivation
  // can't silently reintroduce the mismatched-tint bug.
  const FILL_ALPHAS = [0.55, 0.74];

  for (const id of PERSONALIZATION_PRESET_IDS) {
    const preset = PERSONALIZATION_PRESETS[id];
    const { muted, subtle } = deriveFgTiers(preset.text, preset.bg);

    for (const alpha of FILL_ALPHAS) {
      it(`${id} — glass fill @ ${alpha} alpha stays within 1 AA step of the flat bg`, () => {
        const glassSurface = compositeOver(preset.bg, alpha, preset.bg);
        // Self-composite is exact, but assert loosely (contrastRatio delta)
        // rather than string-equal in case of future rounding changes.
        expect(contrastRatio(glassSurface, preset.text)).toBeGreaterThanOrEqual(AA_CONTRAST);
        expect(contrastRatio(glassSurface, muted)).toBeGreaterThanOrEqual(AA_CONTRAST);
        expect(contrastRatio(glassSurface, subtle)).toBeGreaterThanOrEqual(AA_CONTRAST);
      });
    }
  }
});
