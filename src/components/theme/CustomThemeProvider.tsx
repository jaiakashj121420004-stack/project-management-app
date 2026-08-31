import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  applyCustomTheme,
  customThemeEquals,
  DEFAULT_CUSTOM_THEME,
  getStoredCustomTheme,
  resetCustomTheme as resetStoredCustomTheme,
  sanitizeCustomTheme,
  storeCustomTheme,
  type CustomThemeSettings,
} from '@/lib/customTheme';
import { useAuth } from '@/hooks/useAuth';
import { useProfile, useUpdateProfile } from '@/features/auth/useProfile';
import { CustomThemeContext, type CustomThemeContextValue } from './customTheme-context';

/**
 * Holds the active font-pairing/custom-colors settings, applies them to
 * `<html>`, and (2026-08-15) syncs them to the signed-in user's account.
 *
 * Boot ordering: `applyCustomTheme(getStoredCustomTheme())` still runs
 * INSTANTLY in main.tsx before React mounts, exactly as before — this
 * provider's initial state just mirrors that same localStorage read, so
 * there is no flash on first paint whether or not a session exists.
 *
 * Account sync only ever happens after mount, once `useProfile` resolves:
 * this is deliberately NOT part of the pre-paint boot path, because a
 * network fetch can't block first paint the same way a synchronous
 * localStorage read can (see ThemeProvider for the identical reasoning on
 * the Day/Night toggle). `profile.custom_theme` is null until a signed-in
 * user has changed personalization at least once (see the migration) —
 * that's what stops a brand-new profile from clobbering this device's local
 * customization on first login after this feature shipped.
 */
export function CustomThemeProvider({ children }: { children: ReactNode }) {
  const [settings, setSettingsState] = useState<CustomThemeSettings>(getStoredCustomTheme);
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const updateProfile = useUpdateProfile();

  useEffect(() => {
    if (!profile?.custom_theme) return;
    const serverSettings = sanitizeCustomTheme(profile.custom_theme);
    // Functional update so this effect depends on nothing but the SERVER
    // value — reading the latest local `settings` via the updater (instead
    // of as a dependency) is what stops a fresh local edit from being
    // stomped by a stale `profile.custom_theme` while our own write to the
    // account is still in flight (the effect would otherwise re-fire on
    // every local change too, before the refetch catches up).
    // Setting state inside this effect is intentional: this syncs an
    // external source of truth (the account's saved custom theme) and must
    // also run real side effects (`applyCustomTheme`/`storeCustomTheme`
    // touch the DOM and localStorage), neither of which belongs in a pure
    // render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSettingsState((prev) => {
      if (customThemeEquals(serverSettings, prev)) return prev;
      applyCustomTheme(serverSettings);
      storeCustomTheme(serverSettings);
      return serverSettings;
    });
  }, [profile?.custom_theme]);

  const setSettings = useCallback(
    (next: CustomThemeSettings) => {
      applyCustomTheme(next);
      storeCustomTheme(next);
      setSettingsState(next);
      // localStorage above is unchanged (instant local effect / signed-out
      // fallback); this additionally writes through to the account so
      // another device picks it up on next load.
      if (user) updateProfile.mutate({ customTheme: next });
    },
    [user, updateProfile],
  );

  const resetSettings = useCallback(() => {
    resetStoredCustomTheme();
    setSettingsState(DEFAULT_CUSTOM_THEME);
    if (user) updateProfile.mutate({ customTheme: DEFAULT_CUSTOM_THEME });
  }, [user, updateProfile]);

  const value = useMemo<CustomThemeContextValue>(
    () => ({ settings, setSettings, resetSettings }),
    [settings, setSettings, resetSettings],
  );

  return <CustomThemeContext.Provider value={value}>{children}</CustomThemeContext.Provider>;
}
