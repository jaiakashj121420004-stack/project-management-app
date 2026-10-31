/**
 * haptics.ts — one tiny entry point for tactile feedback.
 *
 * Order of preference: the Capacitor Haptics plugin when the app is wrapped as
 * a native iOS/Android shell (real Taptic Engine), then the Vibration API
 * (Android Chrome / installed PWA). Plain iOS Safari has neither, so it is a
 * silent no-op there — never an error. Respects the in-app toggle and the
 * system "reduce motion" preference.
 */
export type HapticKind = 'tap' | 'success' | 'warning' | 'error';

const KEY = 'aurora-haptics';
const PATTERNS: Record<HapticKind, number | number[]> = {
  tap: 8,
  success: [10, 40, 18],
  warning: [20, 60, 20],
  error: [30, 50, 30, 50, 30],
};

interface CapacitorHaptics {
  impact?: (o: { style: 'LIGHT' | 'MEDIUM' | 'HEAVY' }) => Promise<void>;
  notification?: (o: { type: 'SUCCESS' | 'WARNING' | 'ERROR' }) => Promise<void>;
}

function capacitorHaptics(): CapacitorHaptics | null {
  const cap = (globalThis as { Capacitor?: { Plugins?: { Haptics?: CapacitorHaptics } } }).Capacitor;
  return cap?.Plugins?.Haptics ?? null;
}

export function hapticsSupported(): boolean {
  return capacitorHaptics() !== null || (typeof navigator !== 'undefined' && 'vibrate' in navigator);
}

export function hapticsEnabled(): boolean {
  try {
    return localStorage.getItem(KEY) !== 'off';
  } catch {
    return true;
  }
}

export function setHapticsEnabled(on: boolean): void {
  try {
    localStorage.setItem(KEY, on ? 'on' : 'off');
  } catch {
    /* storage blocked — preference just won't persist */
  }
}

export function haptic(kind: HapticKind = 'tap'): void {
  if (!hapticsEnabled()) return;
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  const native = capacitorHaptics();
  if (native) {
    if (kind === 'tap') void native.impact?.({ style: 'LIGHT' }).catch(() => undefined);
    else {
      const type = kind === 'success' ? 'SUCCESS' : kind === 'warning' ? 'WARNING' : 'ERROR';
      void native.notification?.({ type }).catch(() => undefined);
    }
    return;
  }
  try {
    navigator.vibrate?.(PATTERNS[kind]);
  } catch {
    /* some browsers throw without a user gesture — ignore */
  }
}
