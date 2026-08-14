import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { applyTheme, getInitialTheme, storeTheme, type Theme } from '@/lib/theme';
import { ThemeContext, type ThemeContextValue } from './theme-context';

/**
 * Holds the active theme, persists it, and reflects it on <html>. The class
 * flip in `applyTheme` is instant — CSS custom properties do the rest, so
 * there's no flash or jank to paper over.
 *
 * REMOVED (2026-08-13): theme switching used to cross-fade via
 * `document.startViewTransition()`. It broke production twice in a row.
 * Attempt 1: the callback called React's `setState` directly, which React
 * 18/19 batches asynchronously — the transition's "after" snapshot could be
 * captured before React had actually committed, so the transition never
 * finished, leaving its old/new snapshot layer stuck on screen forever
 * (visible as ghosted old-page content on top of the real page, and — since
 * that stuck full-page overlay sits above everything — silently eating every
 * click on the page). Fixed with `flushSync` around the state update, and
 * confirmed live that this made the transition's own Animation objects finish
 * correctly (`document.getAnimations()` no longer showed anything stuck in
 * `playState: 'running'`). Attempt 2 still failed anyway: the ghosting kept
 * reproducing live even with zero active animations — this app's glass
 * surfaces use `backdrop-filter: blur()` everywhere, and there is a known
 * class of Chromium compositor bug where View Transitions' full-page snapshot
 * layer bakes in a stale blurred frame independent of the Animation Web API
 * state, i.e. a browser rendering bug, not something fixable from this app's
 * JS. Given a whole-document View Transition combined with pervasive backdrop
 * blur is exactly the combination that trips this, and it had already broken
 * production twice, the reliable fix is to not use it: theme changes are a
 * plain, instant class swap now, same as they always were for
 * reduced-motion users and for browsers without View Transitions support.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme);

  const setTheme = useCallback((next: Theme) => {
    applyTheme(next);
    setThemeState(next);
    storeTheme(next);
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
