/**
 * nativePush.ts — register this device for push in the iOS / Android shells.
 *
 * Uses Firebase Cloud Messaging for BOTH platforms (on iOS the plugin bridges
 * APNs → FCM), so the server only needs one sender: `send-native-push`.
 * Tokens are stored in `push_tokens` (RLS: a user manages only their own).
 */
import { supabase } from '@/lib/supabase';
import { appPlatform } from './platform';

async function messaging() {
  return (await import('@capacitor-firebase/messaging')).FirebaseMessaging;
}

async function saveToken(userId: string, token: string): Promise<void> {
  const platform = appPlatform();
  if (platform !== 'ios' && platform !== 'android') return;
  await supabase
    .from('push_tokens')
    .upsert(
      { user_id: userId, platform, token, last_seen_at: new Date().toISOString() },
      { onConflict: 'token' },
    );
}

/** Ask permission (first run) and store/refresh this device's token. */
export async function registerNativePush(userId: string): Promise<void> {
  const FirebaseMessaging = await messaging();
  const perm = await FirebaseMessaging.requestPermissions();
  if (perm.receive !== 'granted') return;
  const { token } = await FirebaseMessaging.getToken();
  if (token) await saveToken(userId, token);
  await FirebaseMessaging.addListener('tokenReceived', (e) => void saveToken(userId, e.token));
}

/** On sign-out: stop this device receiving the previous user's notifications. */
export async function unregisterNativePush(): Promise<void> {
  try {
    const FirebaseMessaging = await messaging();
    const { token } = await FirebaseMessaging.getToken();
    if (token) await supabase.from('push_tokens').delete().eq('token', token);
    await FirebaseMessaging.deleteToken();
    await FirebaseMessaging.removeAllListeners();
  } catch {
    // Not registered — nothing to undo.
  }
}

/** Tapping a notification deep-links to its `url` data field (same-origin paths only). */
export async function onNotificationTap(go: (path: string) => void): Promise<void> {
  const FirebaseMessaging = await messaging();
  await FirebaseMessaging.addListener('notificationActionPerformed', (e) => {
    const url = (e.notification.data as { url?: string } | undefined)?.url;
    if (url && url.startsWith('/') && !url.startsWith('//')) go(url);
  });
}
