import { beforeEach, describe, expect, it } from 'vitest';
import { disableLock, enableLock, readLock, verifyPin } from './appLock';

describe('appLock', () => {
  beforeEach(() => localStorage.clear());

  it('stores a hash, never the PIN, and verifies correctly', async () => {
    await enableLock('2468');
    const raw = localStorage.getItem('aurora-applock') ?? '';
    expect(raw).not.toContain('2468');
    expect(await verifyPin('2468')).toBe(true);
    expect(await verifyPin('1111')).toBe(false);
  });

  it('rejects malformed PINs and can be disabled', async () => {
    await expect(enableLock('12')).rejects.toThrow();
    await enableLock('1234');
    expect(readLock()).not.toBeNull();
    disableLock();
    expect(readLock()).toBeNull();
    expect(await verifyPin('anything')).toBe(true);
  });
});
