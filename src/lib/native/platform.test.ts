import { afterEach, describe, expect, it } from 'vitest';
import { appPlatform, mustUseStoreBilling } from './platform';

afterEach(() => {
  delete (window as unknown as { Capacitor?: unknown }).Capacitor;
});

describe('appPlatform', () => {
  it('is web by default', () => {
    expect(appPlatform()).toBe('web');
    expect(mustUseStoreBilling()).toBe(false);
  });

  it('detects the native iOS and Android shells', () => {
    (window as unknown as { Capacitor: unknown }).Capacitor = { isNativePlatform: () => true, getPlatform: () => 'ios' };
    expect(appPlatform()).toBe('ios');
    expect(mustUseStoreBilling()).toBe(true);
    (window as unknown as { Capacitor: unknown }).Capacitor = { isNativePlatform: () => true, getPlatform: () => 'android' };
    expect(appPlatform()).toBe('android');
  });

  it('treats a Capacitor web runtime as web', () => {
    (window as unknown as { Capacitor: unknown }).Capacitor = { isNativePlatform: () => false, getPlatform: () => 'web' };
    expect(appPlatform()).toBe('web');
  });
});
