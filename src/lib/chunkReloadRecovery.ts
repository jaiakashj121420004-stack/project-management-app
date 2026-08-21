/**
 * Recovers automatically from a stale-deploy chunk-load failure.
 *
 * Every code-split feature (`lazy(() => import('...'))` — the notes editor,
 * the canvas editor, media modals) fetches a content-hashed JS file by URL.
 * Vite/Rolldown gives each build's chunks a new hash, and Cloudflare Pages'
 * production alias only ever serves the *latest* deployment's files — once a
 * newer build ships, the previous build's hashed filenames are gone.
 *
 * Because the PWA uses `registerType: 'prompt'` (see PWAReloadPrompt) so an
 * in-progress edit is never yanked out from under the user, a tab left open
 * across a deploy keeps running on the OLD app shell: the still-active old
 * service worker intercepts even a plain browser reload and re-serves its own
 * precached (stale) index.html + entry script, whose dynamic imports point at
 * chunk hashes the new deployment no longer has. That surfaces to the user as
 * "Failed to fetch dynamically imported module" inside whichever feature they
 * opened. Worse, `lazy()` caches its rejected promise forever once an import
 * fails, so a boundary's "Try again" button can never actually retry it — only
 * a genuine reload with a fresh service worker recovers.
 *
 * Vite dispatches a `vite:preloadError` event on `window` for exactly this
 * failure (see Vite's "Load Error Handling" docs). We listen once at boot and,
 * the first time it fires, force a clean recovery: unregister the stale
 * service worker(s), clear their caches, and reload — guaranteeing the next
 * load is a genuine network fetch of the current build. A short time-boxed
 * guard (rather than a one-shot flag) stops this from looping if a reload
 * somehow fails again, while still allowing recovery from a *later*, unrelated
 * chunk failure in the same tab session.
 */
const RELOAD_GUARD_KEY = 'aurora:chunk-reload-at';
const RELOAD_GUARD_WINDOW_MS = 20_000;

function recentlyAttemptedReload(): boolean {
  const raw = sessionStorage.getItem(RELOAD_GUARD_KEY);
  if (!raw) return false;
  const at = Number(raw);
  return Number.isFinite(at) && Date.now() - at < RELOAD_GUARD_WINDOW_MS;
}

async function recoverAndReload(): Promise<void> {
  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
    }
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }
  } catch {
    // Best-effort cleanup — reload regardless; a plain network fetch of the
    // current build still beats a permanently-broken lazy import.
  } finally {
    window.location.reload();
  }
}

export function setupChunkReloadRecovery(): void {
  window.addEventListener('vite:preloadError', (event) => {
    // We're handling recovery ourselves; don't let it also surface as an
    // uncaught console error on top of the boundary's fallback UI.
    event.preventDefault();

    if (recentlyAttemptedReload()) {
      // Already tried a clean reload very recently and it still failed —
      // don't loop forever. Let the error boundary's fallback UI stand so the
      // user isn't stuck in a silent reload cycle.
      return;
    }
    sessionStorage.setItem(RELOAD_GUARD_KEY, String(Date.now()));
    void recoverAndReload();
  });
}
