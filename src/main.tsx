import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@fontsource-variable/space-grotesk';
import '@fontsource-variable/inter';
import App from '@/App';
import { ThemeProvider } from '@/components/theme/ThemeProvider';
import { AuthProvider } from '@/features/auth';
import { applyTheme, getInitialTheme } from '@/lib/theme';
import '@/styles/index.css';

// Apply the saved theme before first paint to avoid a flash of the wrong theme.
applyTheme(getInitialTheme());

const queryClient = new QueryClient();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element #root not found in index.html');
}

createRoot(rootElement).render(
  <StrictMode>
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>,
);
