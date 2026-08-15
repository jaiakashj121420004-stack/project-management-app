import { useCallback, useEffect, useState } from 'react';

/**
 * The `beforeinstallprompt` event (Chrome/Edge/Android — not in the DOM lib
 * typings). We preventDefault it and stash it here so it can be re-fired later
 * from a user click, instead of the browser's own (easy-to-miss) mini-infobar.
 */
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt(): Promise<void>;
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
 * Never prompts automatically — `beforeinstallprompt` is always preventDefault'd
 * and only re-fired from `promptInstall()`, which callers wire to a user click.
 */
export function useInstallPrompt(): UseInstallPromptResult {
  const [deferredEvent, setDeferredEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(isStandalone);

  useEffect(() => {
    function onBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setDeferredEvent(event as BeforeInstallPromptEvent);
    }
    function onInstalled() {
      setInstalled(true);
      setDeferredEvent(null);
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const promptInstall = useCallback(async (): Promise<'accepted' | 'dismissed' | null> => {
    if (!deferredEvent) return null;
    await deferredEvent.prompt();
    const { outcome } = await deferredEvent.userChoice;
    // A prompt event can only be used once — clear it either way.
    setDeferredEvent(null);
    return outcome;
  }, [deferredEvent]);

  return {
    canInstall: deferredEvent !== null && !installed,
    isIOS: !installed && isIOSSafari(),
    isInstalled: installed,
    promptInstall,
  };
}
