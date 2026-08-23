// Swaps the preloaded (non-blocking) optional-font-pairing stylesheet into an
// active <link rel="stylesheet"> once it finishes downloading. Kept as an
// external file (not an inline onload="…" attribute) so the Content-Security-
// Policy can use a strict `script-src 'self'` with no inline-script hash or
// 'unsafe-inline' — same reasoning as theme-init.js. See index.html for why
// this stylesheet is preloaded instead of loaded directly: it holds the four
// optional font pairings offered in Settings (Sora/Manrope, Playfair
// Display/Lora, Poppins/Nunito) which most page loads never use, so it
// shouldn't block first paint the way the always-needed Fraunces/Spectral/IBM
// Plex Mono stylesheet does.
(function () {
  var link = document.getElementById('optional-fonts-preload');
  if (!link) return;
  var activate = function () {
    link.rel = 'stylesheet';
  };
  if (link.sheet) {
    // Already finished loading (e.g. served from cache before this script ran).
    activate();
    return;
  }
  link.addEventListener('load', activate, { once: true });
})();
