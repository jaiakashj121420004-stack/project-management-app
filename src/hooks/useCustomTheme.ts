import { useContext } from 'react';
import {
  CustomThemeContext,
  type CustomThemeContextValue,
} from '@/components/theme/customTheme-context';

export function useCustomTheme(): CustomThemeContextValue {
  const context = useContext(CustomThemeContext);
  if (!context) {
    throw new Error('useCustomTheme must be used within a CustomThemeProvider');
  }
  return context;
}
