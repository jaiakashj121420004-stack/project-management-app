export type Theme = 'dark' | 'light';

const STORAGE_KEY = 'aurora-theme';

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

/** Reflect the theme on <html> so CSS variables and Tailwind's dark: variant flip. */
export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  root.classList.remove('dark', 'light');
  root.classList.add(theme);
}
