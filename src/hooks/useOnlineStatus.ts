import { useSyncExternalStore } from 'react';

/**
 * Tracks the browser's online/offline state. Backed by useSyncExternalStore so
 * it reads the live `navigator.onLine` value and re-renders on the window
 * online/offline events — used to surface the offline banner and to pause
 * background reminder polling when there's no network.
 */
function subscribe(callback: () => void): () => void {
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  return () => {
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
  };
}

export function useOnlineStatus(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true, // assume online during SSR/first paint
  );
}
