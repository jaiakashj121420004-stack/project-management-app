import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  closeCommandPalette,
  getPaletteOpen,
  openCommandPalette,
  subscribeToPalette,
  toggleCommandPalette,
} from './paletteStore';

// The store is a module-level singleton, so reset it to closed around each test.
beforeEach(() => closeCommandPalette());
afterEach(() => closeCommandPalette());

describe('paletteStore', () => {
  it('opens and closes, reflected in getPaletteOpen()', () => {
    expect(getPaletteOpen()).toBe(false);
    openCommandPalette();
    expect(getPaletteOpen()).toBe(true);
    closeCommandPalette();
    expect(getPaletteOpen()).toBe(false);
  });

  it('toggles between open and closed', () => {
    toggleCommandPalette();
    expect(getPaletteOpen()).toBe(true);
    toggleCommandPalette();
    expect(getPaletteOpen()).toBe(false);
  });

  it('notifies subscribers on change', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToPalette(listener);

    openCommandPalette();
    expect(listener).toHaveBeenCalledWith(true);
    closeCommandPalette();
    expect(listener).toHaveBeenCalledWith(false);

    unsubscribe();
  });

  it('does not emit when the value is unchanged (idempotent open)', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToPalette(listener);

    openCommandPalette();
    openCommandPalette(); // already open — must not re-notify
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
  });

  it('stops notifying after unsubscribe', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToPalette(listener);
    unsubscribe();

    openCommandPalette();
    expect(listener).not.toHaveBeenCalled();
  });
});
