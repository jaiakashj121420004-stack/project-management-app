/**
 * bootstrap.ts — one-time wiring that only matters inside the iOS / Android
 * shells: identify the store-billing customer, register for push, tint the
 * status bar. A no-op on the web and the Windows package.
 */
import { supabase } from '@/lib/supabase';
import { isNativeApp } from './platform';
import { initStoreBilling, resetStoreBilling } from './storeBilling';
import { onNotificationTap, registerNativePush, unregisterNativePush } from './nativePush';

let started = false;

export function startNativeBootstrap(navigate: (path: string) => void): void {
  if (started || !isNativeApp()) return;
  started = true;

  void onNotificationTap(navigate).catch(() => undefined);

  supabase.auth.onAuthStateChange((_event, session) => {
    const userId = session?.user.id;
    if (userId) {
      void initStoreBilling(userId).catch(() => undefined);
      void registerNativePush(userId).catch(() => undefined);
    } else {
      void resetStoreBilling();
      void unregisterNativePush();
    }
  });

  void import('@capacitor/status-bar')
    .then(({ StatusBar, Style }) => StatusBar.setStyle({ style: Style.Default }))
    .catch(() => undefined);
}
