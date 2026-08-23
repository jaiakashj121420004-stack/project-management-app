import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
// Nvexis fonts (Fraunces / Spectral / IBM Plex Mono) are loaded via <link> in
// index.html so no self-hosted font dependency is required.
import App from '@/App';
import { Toaster } from '@/components/feedback/Toaster';
import { ThemeProvider } from '@/components/theme/ThemeProvider';
import { CustomThemeProvider } from '@/components/theme/CustomThemeProvider';
// Imported from its own file, not the '@/features/auth' barrel: main.tsx runs
// on every route, so a barrel import here would statically pull in every
// sibling the barrel re-exports (LoginPage, SignUpPage, ForgotPasswordPage,
// ResetPasswordPage, ProfilePage) into the initial bundle regardless of
// App.tsx's lazy() route splitting — this is exactly what the build reported
// as [INEFFECTIVE_DYNAMIC_IMPORT] for those five pages (Phase 7 Lighthouse
// audit, 2026-08-23).
import { AuthProvider } from '@/features/auth/AuthProvider';
import { applyTheme, getInitialTheme } from '@/lib/theme';
import { setupChunkReloadRecovery } from '@/lib/chunkReloadRecovery';
import { applyCustomTheme, getStoredCustomTheme } from '@/lib/customTheme';
import {
  PERSIST_BUSTER,
  PERSIST_MAX_AGE,
  persister,
  queryClient,
} from '@/lib/queryClient';
import '@/styles/index.css';

// Recover automatically if a code-split chunk 404s after a deploy (stale
// service worker + a tab left open across a release) instead of leaving the
// user stuck on a dead "Try again" button — see chunkReloadRecovery.ts.
setupChunkReloadRecovery();

// Apply the saved theme before first paint to avoid a flash of the wrong theme.
applyTheme(getInitialTheme());
// Same reasoning for a saved font pairing / custom colors (Settings page).
applyCustomTheme(getStoredCustomTheme());

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element #root not found in index.html');
}

createRoot(rootElement).render(
  <StrictMode>
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: PERSIST_MAX_AGE,
        buster: PERSIST_BUSTER,
        // Only cache settled, successful queries — never errors or pending.
        dehydrateOptions: {
          shouldDehydrateQuery: (query) => query.state.status === 'success',
        },
      }}
    >
      <AuthProvider>
        {/* ThemeProvider/CustomThemeProvider moved inside AuthProvider +
            PersistQueryClientProvider (2026-08-15): both now sync to the
            account via useProfile()/useUpdateProfile(), which need a
            QueryClient and an auth session. This doesn't change what's
            inside/outside either provider in practice — App (all routes) was
            already nested inside AuthProvider before this change — and the
            pre-paint boot flash guard above (applyTheme/applyCustomTheme) is
            untouched, so there's still no flash on first load either way. */}
        <ThemeProvider>
          <CustomThemeProvider>
            {/* Honor prefers-reduced-motion for ALL Framer motion (mount/exit
                transforms the CSS guard can't stop): reducedMotion="user" drops
                transform/layout animation, keeping only opacity. */}
            <MotionConfig reducedMotion="user">
              <BrowserRouter>
                <App />
              </BrowserRouter>
              {/* App-wide toast host — surfaces global mutation-failure feedback
                  (see lib/queryClient MutationCache). Fixed overlay, router-independent. */}
              <Toaster />
            </MotionConfig>
          </CustomThemeProvider>
        </ThemeProvider>
      </AuthProvider>
    </PersistQueryClientProvider>
  </StrictMode>,
);
