/**
 * push.ts — client half of Web Push (works when the app is closed).
 *
 * The browser half is complete: permission, subscription, and the service
 * worker's push handler (public/push-sw.js). A push *sender* (server with
 * VAPID keys) must exist for messages to arrive; until VITE_VAPID_PUBLIC_KEY
 * is set, `pushConfigured()` is false and the UI stays hidden.
 */
export function pushConfigured(): boolean {
  return Boolean(import.meta.env.VITE_VAPID_PUBLIC_KEY) && 'serviceWorker' in navigator && 'PushManager' in window;
}

function urlB64ToBytes(s: string): Uint8Array<ArrayBuffer> {
  const pad = '='.repeat((4 - (s.length % 4)) % 4);
  const raw = atob((s + pad).replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** Ask permission and subscribe. Returns the subscription JSON to store server-side, or null. */
export async function subscribeToPush(): Promise<PushSubscriptionJSON | null> {
  if (!pushConfigured()) return null;
  if ((await Notification.requestPermission()) !== 'granted') return null;
  const reg = await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlB64ToBytes(import.meta.env.VITE_VAPID_PUBLIC_KEY as string),
    }));
  return sub.toJSON();
}

export async function unsubscribeFromPush(): Promise<void> {
  const reg = await navigator.serviceWorker.ready;
  await (await reg.pushManager.getSubscription())?.unsubscribe();
}
