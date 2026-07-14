import { describe, it, expect } from 'vitest';
import {
  AA_CONTRAST,
  compositeOver,
  contrastRatio,
  hexToRgb,
  mix,
  readableOnTint,
  relativeLuminance,
  rgbToHex,
  THEME_BG,
  PILL_TINT_ALPHA,
} from './contrast';
import { LABEL_COLOR_NAMES, labelTextColor, labelHex } from './labelColors';
import type { Theme } from './theme';

const THEMES: Theme[] = ['light', 'dark'];

describe('hex ⇄ rgb', () => {
  it('parses 3- and 6-digit hex', () => {
    expect(hexToRgb('#fff')).toEqual([255, 255, 255]);
    expect(hexToRgb('#000000')).toEqual([0, 0, 0]);
    expect(hexToRgb('#8B5CF6')).toEqual([139, 92, 246]);
  });

  it('round-trips through rgbToHex', () => {
    expect(rgbToHex([139, 92, 246])).toBe('#8b5cf6');
    expect(rgbToHex([0, 0, 0])).toBe('#000000');
  });

  it('throws on malformed hex', () => {
    expect(() => hexToRgb('#12')).toThrow();
    expect(() => hexToRgb('nope')).toThrow();
  });
});

describe('relativeLuminance / contrastRatio', () => {
  it('gives the canonical extremes', () => {
    expect(relativeLuminance('#000000')).toBeCloseTo(0, 5);
    expect(relativeLuminance('#ffffff')).toBeCloseTo(1, 5);
    // Black on white is the maximum 21:1; a colour against itself is 1:1.
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 1);
    expect(contrastRatio('#7A2A26', '#7A2A26')).toBeCloseTo(1, 5);
  });

  it('is order-independent', () => {
    expect(contrastRatio('#123456', '#abcdef')).toBeCloseTo(
      contrastRatio('#abcdef', '#123456'),
      6,
    );
  });
});

describe('mix / compositeOver', () => {
  it('interpolates endpoints', () => {
    expect(mix('#000000', '#ffffff', 0)).toBe('#000000');
    expect(mix('#000000', '#ffffff', 1)).toBe('#ffffff');
    expect(mix('#000000', '#ffffff', 0.5)).toBe('#808080');
  });

  it('compositing at alpha 1 returns the foreground; at 0 the background', () => {
    expect(compositeOver('#ff0000', 1, '#00ff00')).toBe('#ff0000');
    expect(compositeOver('#ff0000', 0, '#00ff00')).toBe('#00ff00');
  });
});

describe('label pill text clears AA on its tint in both themes', () => {
  for (const theme of THEMES) {
    for (const name of LABEL_COLOR_NAMES) {
      it(`${name} · ${theme}`, () => {
        const hue = labelHex(name);
        const tint = compositeOver(hue, PILL_TINT_ALPHA, THEME_BG[theme]);
        const text = labelTextColor(name, theme);
        expect(contrastRatio(text, tint)).toBeGreaterThanOrEqual(AA_CONTRAST);
      });
    }
  }
});

describe('readableOnTint is deterministic and always AA', () => {
  it('returns the same value for the same input', () => {
    expect(readableOnTint('#06B6D4', 'light')).toBe(readableOnTint('#06B6D4', 'light'));
  });
});

// The priority-pill + status tokens are authored as CSS vars in styles/index.css.
// Mirror the chosen values here so a regression that lowers their contrast is
// caught: each must clear AA as text on its own tint (priority) / on the base
// surface and its 15% badge tint (success/info).
describe('priority-pill tokens clear AA on their tint', () => {
  const TINT_ALPHA = 0.15;
  const PRIORITY: Record<Theme, { fg: string; hue: string }[]> = {
    light: [
      { fg: '#9c3328', hue: '#b23a2e' }, // critical
      { fg: '#95450d', hue: '#f97316' }, // high
      { fg: '#6e5525', hue: '#8a6a2e' }, // medium
      { fg: '#2858a6', hue: '#3b82f6' }, // low
    ],
    dark: [
      { fg: '#da6e56', hue: '#d8634a' },
      { fg: '#f97316', hue: '#f97316' },
      { fg: '#c7a24e', hue: '#c7a24e' },
      { fg: '#498af5', hue: '#3b82f6' },
    ],
  };
  for (const theme of THEMES) {
    for (const { fg, hue } of PRIORITY[theme]) {
      it(`${fg} on ${hue} tint · ${theme}`, () => {
        const tint = compositeOver(hue, TINT_ALPHA, THEME_BG[theme]);
        expect(contrastRatio(fg, tint)).toBeGreaterThanOrEqual(AA_CONTRAST);
      });
    }
  }
});

describe('success/info tokens clear AA on base and their badge tint', () => {
  const TINT_ALPHA = 0.15;
  const STATUS: Record<Theme, string[]> = {
    light: ['#3e5a46', '#5e5346'], // success, info
    dark: ['#7fb08a', '#c7b9a6'],
  };
  for (const theme of THEMES) {
    for (const hex of STATUS[theme]) {
      it(`${hex} · ${theme}`, () => {
        const base = THEME_BG[theme];
        const tint = compositeOver(hex, TINT_ALPHA, base);
        expect(contrastRatio(hex, base)).toBeGreaterThanOrEqual(AA_CONTRAST);
        expect(contrastRatio(hex, tint)).toBeGreaterThanOrEqual(AA_CONTRAST);
      });
    }
  }
});
