// Generic preload->stylesheet swap for build-time-injected CSS chunks that
// shouldn't sit on the critical rendering path of most page loads (see
// vite.config.ts's `deferEditorCss` plugin, which rewrites their
// <link rel="stylesheet"> into <link rel="preload" as="style" data-css-swap>
// so the browser fetches the file in parallel instead of blocking first
// paint on it). This script activates every such link once it finishes
// downloading — the same pattern font-swap.js already uses for the optional
// font-pairing stylesheet, generalized to more than one link and kept as an
// external file for the same CSP reason: a strict `script-src 'self'` with
// no inline-script hash or 'unsafe-inline'.
(function () {
  var links = document.querySelectorAll('link[rel="preload"][as="style"][data-css-swap]');
  for (var i = 0; i < links.length; i++) {
    (function (link) {
      var activate = function () {
        link.rel = 'stylesheet';
      };
      if (link.sheet) {
        // Already finished loading (e.g. served from cache before this
        // deferred script ran).
        activate();
        return;
      }
      link.addEventListener('load', activate, { once: true });
    })(links[i]);
  }
})();
