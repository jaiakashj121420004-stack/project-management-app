import { fileURLToPath, URL } from 'node:url';
import { defineConfig, type PluginOption } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { visualizer } from 'rollup-plugin-visualizer';

/**
 * Split heavy third-party code out of the app + vendor bundle so the initial
 * load ships only what a route needs. The two biggest offenders each get their
 * own chunk that is only fetched when that feature mounts (both are already
 * behind lazy routes): the **Tiptap/ProseMirror + Yjs** rich-text stack and the
 * **Konva** canvas stack. Everything else in node_modules stays in one `vendor`
 * chunk. Returning `undefined` leaves a module in Rollup's default chunk.
 */
function manualChunks(id: string): string | undefined {
  if (!id.includes('node_modules')) return undefined;
  if (id.includes('konva') || id.includes('perfect-freehand')) return 'canvas';
  if (
    id.includes('@tiptap') ||
    id.includes('prosemirror') ||
    id.includes('/yjs/') ||
    id.includes('y-protocols')
  ) {
    return 'editor';
  }
  return 'vendor';
}

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
        // With the editor/canvas stacks split into their own chunks (see
        // manualChunks), no single asset approaches the old 4 MB bundle, so the
        // precache cap comes back down to 2 MB. Tighten further using the
        // bundle-visualizer report (dist/stats.html) if a chunk grows.
        maximumFileSizeToCacheInBytes: 2 * 1024 * 1024,
      },
    }),
    // Emits dist/stats.html on every build — an interactive treemap of what's in
    // each chunk, so bundle regressions are visible in review. Never affects the
    // shipped app.
    visualizer({
      filename: 'dist/stats.html',
      gzipSize: true,
      brotliSize: true,
    }) as PluginOption,
  ],
  build: {
    rollupOptions: {
      output: { manualChunks },
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
