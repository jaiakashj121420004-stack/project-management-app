export type Theme = 'dark' | 'light';

const STORAGE_KEY = 'aurora-theme';

/** Browser-chrome color per theme — matches the --bg base in styles/index.css. */
export const THEME_COLORS: Record<Theme, string> = {
  dark: '#0B0710',
  light: '#FAF7FF',
};

/** The persisted theme, or null if the user has never chosen one. */
export function getStoredTheme(): Theme | null {
  const value = localStorage.getItem(STORAGE_KEY);
  return value === 'dark' || value === 'light' ? value : null;
}

export function storeTheme(theme: Theme): void {
  localStorage.setItem(STORAGE_KEY, theme);
}

/** Initial theme: explicit choice → OS preference → dark (the brand default). */
export function getInitialTheme(): Theme {
  const stored = getStoredTheme();
  if (stored) return stored;
  if (window.matchMedia('(prefers-color-scheme: light)').matches) return 'light';
  return 'dark';
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
