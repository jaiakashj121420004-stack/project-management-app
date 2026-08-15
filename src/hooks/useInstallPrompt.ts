import { useCallback, useEffect, useState } from 'react';

/**
 * The `beforeinstallprompt` event (Chrome/Edge/Android — not in the DOM lib
 * typings). `public/pwa-install-capture.js` (loaded in index.html, before
 * React) is the one place that actually listens for it and calls
 * `preventDefault()` — see that file's header comment for why capturing it
 * from inside a React hook is too late on a repeat visit. This hook only
 * reads what that script already stashed.
 */
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt(): Promise<void>;
}

declare global {
  interface Window {
    /** Set by public/pwa-install-capture.js the instant beforeinstallprompt fires. */
    __auroraInstallPrompt?: BeforeInstallPromptEvent;
  }
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  // iOS Safari exposes navigator.standalone instead of the display-mode media
  // query; check both so "already installed" is detected everywhere.
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return (
    (typeof window.matchMedia === 'function' &&
      window.matchMedia('(display-mode: standalone)').matches) ||
    nav.standalone === true
  );
}

/**
 * iOS never fires `beforeinstallprompt` — Apple only exposes "Add to Home
 * Screen" through Safari's own Share sheet. Every other iOS browser (Chrome,
 * Firefox, Edge) is really Safari's engine wearing a different UA string and
 * does NOT expose that Share-sheet action the same way, so only bare Safari on
 * an iOS device counts as "installable via instructions."
 */
function isIOSSafari(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const isIOSDevice =
    /iPad|iPhone|iPod/.test(ua) ||
    // iPadOS 13+ reports as "Macintosh" but is touch-capable, unlike a real Mac.
    (ua.includes('Macintosh') && navigator.maxTouchPoints > 1);
  if (!isIOSDevice) return false;
  return !/CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua);
}

export interface UseInstallPromptResult {
  /** True once Chrome/Edge/Android has offered a native install prompt to stash. */
  canInstall: boolean;
  /** True on iOS Safari — no native prompt exists there; show manual instructions. */
  isIOS: boolean;
  /** True once the app is already running installed (standalone / iOS Home Screen). */
  isInstalled: boolean;
  /** Fires the stashed native prompt. Resolves to the user's choice, or null if none is stashed. */
  promptInstall: () => Promise<'accepted' | 'dismissed' | null>;
}

/**
 * Surfaces whether "Install Aurora" should be offered right now, and how.
 * Never prompts automatically — `pwa-install-capture.js` always preventDefault's
 * `beforeinstallprompt`, and the native prompt only fires from `promptInstall()`,
 * which callers wire to a user click.
 */
export function useInstallPrompt(): UseInstallPromptResult {
  // Lazy-init from window.__auroraInstallPrompt: the capture script may have
  // already stashed the event before this component ever mounted (it fires as
  // soon as the browser validates installability, which can beat the auth
  // check + provider tree in main.tsx to the punch on a repeat visit).
  const [deferredEvent, setDeferredEvent] = useState<BeforeInstallPromptEvent | null>(
    () => window.__auroraInstallPrompt ?? null,
  );
  const [installed, setInstalled] = useState(isStandalone);

  useEffect(() => {
    // Covers the event arriving AFTER this component mounts — the capture
    // script dispatches this custom event right after stashing it.
    function onCaptured() {
      setDeferredEvent(window.__auroraInstallPrompt ?? null);
    }
    function onInstalled() {
      setInstalled(true);
      setDeferredEvent(null);
      window.__auroraInstallPrompt = undefined;
    }
    window.addEventListener('aurora:beforeinstallprompt', onCaptured);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('aurora:beforeinstallprompt', onCaptured);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const promptInstall = useCallback(async (): Promise<'accepted' | 'dismissed' | null> => {
    const event = deferredEvent ?? window.__auroraInstallPrompt ?? null;
    if (!event) return null;
    await event.prompt();
    const { outcome } = await event.userChoice;
    // A prompt event can only be used once — clear it either way.
    setDeferredEvent(null);
    window.__auroraInstallPrompt = undefined;
    return outcome;
  }, [deferredEvent]);

  return {
    canInstall: deferredEvent !== null && !installed,
    isIOS: !installed && isIOSSafari(),
    isInstalled: installed,
    promptInstall,
  };
}
