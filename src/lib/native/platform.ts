/**
 * platform.ts — where is Jotspring running? Used to pick the right billing path:
 *  - web / windows → Dodo Payments checkout
 *  - ios / android → the store's own billing (Apple / Google), never Dodo
 *
 * Reads the Capacitor bridge if present (injected by the native shells) so the
 * web build needs no Capacitor dependency. Windows is detected from a URL flag
 * or the MSIX/PWABuilder user agent.
 */
export type AppPlatform = 'web' | 'ios' | 'android' | 'windows-store';

interface CapacitorGlobal {
  getPlatform?: () => string;
  isNativePlatform?: () => boolean;
}

export function appPlatform(): AppPlatform {
  if (typeof window === 'undefined') return 'web';
  const cap = (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor;
  if (cap?.isNativePlatform?.()) {
    const p = cap.getPlatform?.();
    if (p === 'ios') return 'ios';
    if (p === 'android') return 'android';
  }
  if (new URLSearchParams(window.location.search).get('src') === 'msstore') return 'windows-store';
  return 'web';
}

export const isNativeApp = (): boolean => {
  const p = appPlatform();
  return p === 'ios' || p === 'android';
};

/** True when payments must go through Apple / Google instead of Dodo. */
export const mustUseStoreBilling = (): boolean => isNativeApp();
