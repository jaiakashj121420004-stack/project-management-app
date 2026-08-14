import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { applyTheme, getInitialTheme, storeTheme, type Theme } from '@/lib/theme';
import { ThemeContext, type ThemeContextValue } from './theme-context';

/**
 * Holds the active theme, persists it, and reflects it on <html>. Switching
 * cross-fades via the View Transitions API where available, falling back to the
 * CSS color/background transition on <body>. Reduced-motion users skip the
 * animated transition entirely.
 *
 * BUG FIX (2026-08-13): `document.startViewTransition()`'s callback must finish
 * updating the DOM *synchronously* before the browser captures the "after"
 * snapshot and resolves the transition — but a plain `setState` call is batched
 * by React 18/19 and doesn't commit within that synchronous callback. The
 * browser was left waiting on a commit that already happened from its
 * perspective but hadn't actually landed in the DOM from React's, so the
 * transition never finished: the old/new cross-fade snapshots stayed stuck on
 * screen indefinitely (visible as ghosted old-page content on top of the real
 * page) and — because that stuck overlay sits above everything — silently ate
 * every click on the page. `flushSync` forces React to commit inside the
 * callback, so the browser always sees the real, finished DOM before it moves
 * on. Confirmed live via `document.getAnimations()` showing the transition's
 * pseudo-element animations stuck in `playState: 'running'` forever without
 * this; clean (animations finish and get removed) with it.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme);

  const setTheme = useCallback((next: Theme) => {
    const commit = () => {
      flushSync(() => {
        applyTheme(next);
        setThemeState(next);
      });
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
