import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import '@fontsource-variable/space-grotesk';
import '@fontsource-variable/inter';
import App from '@/App';
import { ThemeProvider } from '@/components/theme/ThemeProvider';
import { AuthProvider } from '@/features/auth';
import { applyTheme, getInitialTheme } from '@/lib/theme';
import {
  PERSIST_BUSTER,
  PERSIST_MAX_AGE,
  persister,
  queryClient,
} from '@/lib/queryClient';
import '@/styles/index.css';

// Apply the saved theme before first paint to avoid a flash of the wrong theme.
applyTheme(getInitialTheme());

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element #root not found in index.html');
}

createRoot(rootElement).render(
  <StrictMode>
    <ThemeProvider>
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
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </AuthProvider>
      </PersistQueryClientProvider>
    </ThemeProvider>
  </StrictMode>,
);
