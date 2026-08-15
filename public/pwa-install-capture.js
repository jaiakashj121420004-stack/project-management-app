// Captures `beforeinstallprompt` as early as possible — before React mounts,
// before AuthProvider resolves the session, before any provider in the tree
// renders — so a fast-firing event on a repeat visit is never missed.
//
// Why this exists: `beforeinstallprompt` fires once per navigation, as soon as
// the browser finishes validating installability (manifest + service worker).
// On a repeat visit that can happen very quickly — sometimes before
// `src/hooks/useInstallPrompt.ts`'s `useEffect` ever runs, since that hook only
// mounts once React renders, which waits on the auth check and provider tree
// in `src/main.tsx`. If nobody has called `event.preventDefault()` by the time
// the event fires, Chrome falls back to showing its own native install icon in
// the address bar instead — which is exactly the symptom this file fixes:
// Aurora's own "Install Aurora" affordance in the sidebar was never appearing,
// even though the browser clearly considered the page installable.
//
// Kept as an external file (not inline), same reasoning as theme-init.js: the
// site's CSP uses a strict `script-src 'self'` with no inline-script
// allowance. Loaded in <head>, before the app's module script, so it always
// registers its listener first.
window.addEventListener('beforeinstallprompt', function (event) {
  event.preventDefault();
  window.__auroraInstallPrompt = event;
  window.dispatchEvent(new Event('aurora:beforeinstallprompt'));
});
