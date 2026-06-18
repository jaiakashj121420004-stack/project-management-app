import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vite.dev/config/
// PWA config is intentionally minimal here; the full Aurora manifest, icons,
// and offline strategy land in Phase 9 (see prompt.md).
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Aurora',
        short_name: 'Aurora',
        description: 'A modern project-management app — boards, calendar, notes, collaboration.',
        theme_color: '#0B0710',
        background_color: '#0B0710',
        display: 'standalone',
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
