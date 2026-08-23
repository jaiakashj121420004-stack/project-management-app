export type Theme = 'dark' | 'light';

const STORAGE_KEY = 'aurora-theme';

/** Browser-chrome color per theme — matches the --bg base in styles/index.css.
 *  Nvexis: Night = ink, Day = parchment. */
export const THEME_COLORS: Record<Theme, string> = {
  dark: '#181210',
  light: '#ECE4D6',
};

/** The persisted theme, or null if the user has never chosen one. */
export function getStoredTheme(): Theme | null {
  const value = localStorage.getItem(STORAGE_KEY);
  return value === 'dark' || value === 'light' ? value : null;
}

export function storeTheme(theme: Theme): void {
  localStorage.setItem(STORAGE_KEY, theme);
}

/**
 * Initial theme: explicit choice (this device, or the signed-in account, via
 * ThemeProvider's post-mount reconciliation) → light.
 *
 * Changed 2026-08-23 (Nvexis rebrand, founder direction): light/parchment is
 * now the brand's default surface, not a secondary option — the whole public
 * site and the "mostly light mode" personalization direction assume a visitor
 * lands in Day by default. Previously this fell through to the OS's
 * `prefers-color-scheme` and then to Night if neither matched; that's removed
 * on purpose, not an oversight — a first-time visitor (including a fresh PWA
 * install, which has no prior localStorage) should see Day regardless of
 * system dark-mode, and ONLY switches away from it once they explicitly
 * toggle the theme themselves. `getStoredTheme()` above still means that
 * choice — device-local via `storeTheme`, and account-wide once signed in via
 * `ThemeProvider`'s profile sync — sticks and is never overridden again.
 */
export function getInitialTheme(): Theme {
  return getStoredTheme() ?? 'light';
}

/** Reflect the theme on <html> so CSS variables and Tailwind's dark: variant flip,
 *  and keep the browser-chrome theme-color (address bar / PWA status bar) in sync. */
export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  root.classList.remove('dark', 'light');
  root.classList.add(theme);

  const meta = document.getElementById('theme-color');
  if (meta) meta.setAttribute('content', THEME_COLORS[theme]);
}
