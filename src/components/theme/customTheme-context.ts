import { createContext } from 'react';
import type { CustomThemeSettings } from '@/lib/customTheme';

export interface CustomThemeContextValue {
  settings: CustomThemeSettings;
  /** Replace the whole settings object (SettingsPage owns merging individual
   *  field changes) — applies to `<html>`, persists to localStorage, and (if
   *  signed in) writes through to the account. */
  setSettings: (next: CustomThemeSettings) => void;
  /** Clear every override back to the default, everywhere (local + account). */
  resetSettings: () => void;
}

export const CustomThemeContext = createContext<CustomThemeContextValue | null>(null);
