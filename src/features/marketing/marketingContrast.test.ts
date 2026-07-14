import { describe, expect, it } from 'vitest';
import { AA_CONTRAST, compositeOver, contrastRatio } from '@/lib/contrast';

/**
 * Phase 4 marketing contrast proof. The landing page (`LandingPage.tsx`) and
 * `lodestar.css` were audited for AA text failures: a 0.45-alpha hero caption,
 * `opacity-50` footer strings, and `--lode-gold-deep` (#b8902f) eyebrows on
 * parchment all fell below 4.5:1. This locks in the fixes so a future tweak
 * can't silently regress them.
 *
 * Night backgrounds come from the `.lode-night` gradient (#120d0b → #1c1512 →
 * #241a15); the *lightest* stop is the worst case for light text, so we test
 * against it.
 */
const NIGHT_WORST = '#241a15'; // lightest end of the night gradient
const PARCHMENT = '#ece4d6'; // .lode-paper page
const CHIP_LIGHT = '#fdfaf4'; // "Best value" pricing chip background
const PARCH_TEXT = '#ece4d6'; // rgba(236,228,214,…)
const INK = '#221a14'; // rgba(34,26,20,…) body ink on parchment
const OXBLOOD_DEEP = '#7a2a26'; // --lode-oxblood-deep (Day oxblood for small text)
const GOLD = '#d8b455'; // rgba(216,180,85,…) eyebrow gold on night

/** Text at `alpha` composited over `bg`, then measured against that same bg. */
function ratioAt(text: string, alpha: number, bg: string): number {
  return contrastRatio(compositeOver(text, alpha, bg), bg);
}

describe('marketing text contrast (WCAG AA)', () => {
  it('parchment captions at 0.72 clear AA on the night hero (was 0.45 → fail)', () => {
    expect(ratioAt(PARCH_TEXT, 0.72, NIGHT_WORST)).toBeGreaterThanOrEqual(AA_CONTRAST);
  });

  it('footer strings at 0.72 clear AA (was opacity-50 over 0.6 ≈ 0.3 → fail)', () => {
    expect(ratioAt(PARCH_TEXT, 0.72, NIGHT_WORST)).toBeGreaterThanOrEqual(AA_CONTRAST);
  });

  it('gold eyebrows at 0.9 clear AA on the night hero', () => {
    expect(ratioAt(GOLD, 0.9, NIGHT_WORST)).toBeGreaterThanOrEqual(AA_CONTRAST);
  });

  it('oxblood-deep eyebrows clear AA on parchment (gold-deep #b8902f did not)', () => {
    expect(contrastRatio(OXBLOOD_DEEP, PARCHMENT)).toBeGreaterThanOrEqual(AA_CONTRAST);
    // Guard the regression: the old gold-deep genuinely failed here.
    expect(contrastRatio('#b8902f', PARCHMENT)).toBeLessThan(AA_CONTRAST);
  });

  it('oxblood-deep "Best value" chip text clears AA on the light chip', () => {
    expect(contrastRatio(OXBLOOD_DEEP, CHIP_LIGHT)).toBeGreaterThanOrEqual(AA_CONTRAST);
  });

  it('ink body/period text at 0.72 clears AA on parchment (was 0.5 → fail)', () => {
    expect(ratioAt(INK, 0.72, PARCHMENT)).toBeGreaterThanOrEqual(AA_CONTRAST);
  });
});
