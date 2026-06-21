import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vite.dev/config/
// Phase 9: full Aurora PWA — installable manifest, branded icons, and a
// service worker that precaches the app shell for offline loading. We use the
// "prompt" register type and surface a custom reload prompt in the UI so users
// stay in control of updates (see components/pwa/PWAReloadPrompt).
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      // favicon.svg + apple-touch-icon live in /public and aren't import-graph
      // assets, so list them for precaching explicitly.
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        id: '/',
        name: 'Aurora — Project Management',
        short_name: 'Aurora',
        description:
          'A modern project-management app — Kanban boards, calendar, notes, and real-time collaboration.',
        lang: 'en',
        dir: 'ltr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'any',
        theme_color: '#0B0710',
        background_color: '#0B0710',
        categories: ['productivity', 'business', 'utilities'],
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          {
            src: 'maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
        shortcuts: [
          { name: 'Projects', short_name: 'Projects', url: '/' },
          { name: 'Calendar', short_name: 'Calendar', url: '/calendar' },
          { name: 'To-Do', short_name: 'To-Do', url: '/todos' },
        ],
      },
      workbox: {
        // Precache the built app shell so it loads with no network.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff,woff2}'],
        // SPA fallback: any uncached navigation serves the cached shell, so
        // deep links (and offline reloads) render instead of a browser error.
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        // The main bundle is large (code-splitting is a Phase 10 item); lift the
        // precache size cap so the shell is fully cached.
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
