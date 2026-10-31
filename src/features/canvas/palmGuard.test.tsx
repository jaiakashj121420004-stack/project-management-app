import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { usePalmGuard } from './palmGuard';

function press(target: Element, init: { pointerType: string; width: number; height: number }) {
  const evt = new Event('pointerdown', { bubbles: true, cancelable: true });
  Object.assign(evt, init);
  target.dispatchEvent(evt);
  return evt;
}

describe('usePalmGuard', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('swallows a palm-sized touch on chrome but never on data-palm-safe controls', () => {
    document.body.innerHTML = '<button id="plain">x</button><button id="exit" data-palm-safe>Exit</button>';
    renderHook(() => usePalmGuard(true));
    const palm = { pointerType: 'touch', width: 90, height: 90 };
    expect(press(document.getElementById('plain')!, palm).defaultPrevented).toBe(true);
    expect(press(document.getElementById('exit')!, palm).defaultPrevented).toBe(false);
  });

  it('lets an ordinary fingertip (iPad reports ~44px) tap normal chrome', () => {
    document.body.innerHTML = '<button id="plain">x</button>';
    renderHook(() => usePalmGuard(true));
    const finger = { pointerType: 'touch', width: 44, height: 44 };
    expect(press(document.getElementById('plain')!, finger).defaultPrevented).toBe(false);
  });
});
