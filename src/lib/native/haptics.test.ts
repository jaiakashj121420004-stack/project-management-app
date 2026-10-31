import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { haptic, setHapticsEnabled } from './haptics';

describe('haptics', () => {
  const vibrate = vi.fn();
  beforeEach(() => {
    localStorage.clear();
    vibrate.mockClear();
    Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true });
    window.matchMedia = ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
  });
  afterEach(() => vi.restoreAllMocks());

  it('vibrates when enabled', () => {
    haptic('success');
    expect(vibrate).toHaveBeenCalledWith([10, 40, 18]);
  });
  it('is silent when switched off', () => {
    setHapticsEnabled(false);
    haptic('tap');
    expect(vibrate).not.toHaveBeenCalled();
  });
});
