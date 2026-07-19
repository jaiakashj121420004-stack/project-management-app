// Sets the theme class before first paint to avoid a flash of the wrong theme.
// Kept as an external file (not inline) so the Content-Security-Policy can use a
// strict `script-src 'self'` with no inline-script hash or 'unsafe-inline'.
(function () {
  try {
    var stored = localStorage.getItem('aurora-theme');
    var prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
    var theme = stored === 'dark' || stored === 'light' ? stored : prefersLight ? 'light' : 'dark';
    document.documentElement.classList.remove('dark', 'light');
    document.documentElement.classList.add(theme);
    var meta = document.getElementById('theme-color');
    if (meta) meta.setAttribute('content', theme === 'light' ? '#ECE4D6' : '#181210');
  } catch (e) {
    /* keep the default dark class */
  }
})();
