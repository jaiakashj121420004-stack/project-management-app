import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { applyTheme, getInitialTheme, storeTheme, type Theme } from '@/lib/theme';
import { useAuth } from '@/hooks/useAuth';
import { useProfile, useUpdateProfile } from '@/features/auth/useProfile';
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
 *
 * Account sync (2026-08-15): `getInitialTheme()` above still runs
 * synchronously before first paint (see main.tsx) — that instant boot path is
 * unchanged. Once a signed-in user's profile loads via `useProfile`, if the
 * account's last-saved `theme` differs from what's currently applied (e.g. a
 * choice made on another device), this reconciles toward the SERVER value —
 * but only ever a smooth, post-mount update, never the pre-paint flash guard.
 * `theme` is null until a signed-in user changes it at least once (see the
 * migration), which is what stops a brand-new profile from clobbering this
 * device's local/OS-derived default on first login.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme);
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const updateProfile = useUpdateProfile();

  useEffect(() => {
    if (!profile?.theme) return;
    // Functional update so this depends only on the SERVER value — reading
    // the latest local `theme` via the updater (rather than as a dependency)
    // stops a fresh local toggle from being stomped by a stale `profile.theme`
    // while our own write to the account is still in flight.
    // Setting state inside this effect is intentional: this syncs an
    // external source of truth (the account's saved theme) and must also
    // run real side effects (`applyTheme`/`storeTheme` touch the DOM and
    // localStorage), neither of which belongs in a pure render. See the
    // file header for why this can't use `document.startViewTransition()`
    // or otherwise be restructured — that broke production twice before.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setThemeState((prev) => {
      if (profile.theme === prev) return prev;
      applyTheme(profile.theme as Theme);
      storeTheme(profile.theme as Theme);
      return profile.theme as Theme;
    });
  }, [profile?.theme]);

  const setTheme = useCallback(
    (next: Theme) => {
      applyTheme(next);
      setThemeState(next);
      storeTheme(next);
      // localStorage above is unchanged (instant local effect / signed-out
      // fallback); this additionally writes through to the account so
      // another device picks it up on next load. Fire-and-forget — a failure
      // toasts via the global MutationCache handler (lib/queryClient.ts) and
      // simply leaves the account's stored theme unchanged for next time.
      if (user) updateProfile.mutate({ theme: next });
    },
    [user, updateProfile],
  );

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }, [theme, setTheme]);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, setTheme, toggleTheme }),
    [theme, setTheme, toggleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
