import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { applyTheme, getInitialTheme, storeTheme, type Theme } from '@/lib/theme';
import { ThemeContext, type ThemeContextValue } from './theme-context';

/**
 * Holds the active theme, persists it, and reflects it on <html>. Switching
 * cross-fades via the View Transitions API where available, falling back to the
 * CSS color/background transition on <body>. Reduced-motion users skip the
 * animated transition entirely.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme);

  const setTheme = useCallback((next: Theme) => {
    const commit = () => {
      applyTheme(next);
      setThemeState(next);
    };
    storeTheme(next);

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!prefersReducedMotion && typeof document.startViewTransition === 'function') {
      document.startViewTransition(commit);
    } else {
      commit();
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }, [theme, setTheme]);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, setTheme, toggleTheme }),
    [theme, setTheme, toggleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
