import { fileURLToPath, URL } from 'node:url';
import fs from 'node:fs';
import { defineConfig, type Plugin, type PluginOption } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { visualizer } from 'rollup-plugin-visualizer';

/**
 * Split heavy third-party code out of the app + vendor bundle so the initial
 * load ships only what a route needs. The two biggest offenders each get their
 * own chunk that is only fetched when that feature mounts (both are already
 * behind lazy routes): the **Tiptap/ProseMirror + Yjs** rich-text stack and the
 * **Konva** canvas stack. **KaTeX** (math formulas, nodes/MathFormula.ts) joins
 * the `editor` chunk too — it's only ever imported transitively through
 * extensions.ts, which both lazy surfaces (notes + canvas) already pull in, so
 * this doesn't add a new lazy boundary, it just keeps KaTeX's JS + fonts out of
 * the `vendor` chunk every route pays for. Everything else in node_modules
 * stays in one `vendor` chunk. Returning `undefined` leaves a module in
 * Rollup's default chunk.
 */
function manualChunks(id: string): string | undefined {
  if (!id.includes('node_modules')) return undefined;
  if (id.includes('konva') || id.includes('perfect-freehand')) return 'canvas';
  if (
    id.includes('@tiptap') ||
    id.includes('prosemirror') ||
    id.includes('/yjs/') ||
    id.includes('y-protocols') ||
    id.includes('katex')
  ) {
    return 'editor';
  }
  // `docx` (Word/.docx export, Pro) is only ever reached via a dynamic
  // import() triggered by clicking "Export as Word" (see docxExport.ts) — it
  // must NOT fall into the catch-all 'vendor' chunk below, since that chunk
  // loads eagerly on every route. Returning undefined here lets Rollup give
  // it its own async chunk, split off purely because of how it's imported.
  if (id.includes('/docx/') || id.includes('\\docx\\')) return undefined;
  // PageSpeed follow-up (2026-08-30, PageSpeed report lkdtduvz5x): the
  // dist/stats.html treemap showed @dnd-kit, zod, date-fns, and dompurify —
  // all sizeable boxes — sitting inside the eagerly-loaded 'vendor' chunk
  // that ships on every route, including the anonymous marketing landing
  // page. Grepped every importer of each: @dnd-kit only appears under
  // features/{board,calendar,todos} (drag-and-drop), zod only under each
  // feature's own schemas.ts + the auth forms, dompurify only under
  // features/{editor,notes} — every single one is reached exclusively
  // through an App.tsx lazy() route boundary already. They were only ending
  // up in 'vendor' because this function force-merged them there regardless
  // of that boundary, the same mistake the docx case above already fixes for
  // one package — this generalizes that fix to the rest. Excluding them here
  // lets Rollup split each into its own chunk(s) based on the *real* import
  // graph, so an anonymous/marketing visit no longer downloads
  // drag-and-drop, every feature's Zod validation, and DOMPurify before it
  // can render anything.
  if (
    id.includes('@dnd-kit') ||
    id.includes('/zod/') ||
    id.includes('/date-fns/') ||
    id.includes('dompurify')
  ) {
    return undefined;
  }
  return 'vendor';
}

/**
 * Landing-page screenshots (public/shots/*.png) are optional — the marketing
 * page falls back to a styled CSS mockup for any that aren't dropped in yet
 * (see public/shots/README.txt + LandingPage.tsx's <Shot>). Until real
 * screenshots exist, every visit to the public landing page was issuing 6
 * guaranteed-404 image requests (2 of them above-the-fold, so effectively
 * eager despite loading="lazy") purely to discover that via onError — wasted
 * connection/request budget on exactly the throttled-mobile, anonymous-visit
 * path the mobile Lighthouse Performance score is measured on. This plugin
 * reads public/shots/ at build time and exposes the filenames that actually
 * exist via a virtual module, so <Shot> can skip the network round-trip
 * entirely for shots it already knows aren't there — no manual list to
 * maintain; dropping a real PNG into public/shots/ and rebuilding is still
 * the whole workflow described in that folder's README.
 */
function availableShotsPlugin(): Plugin {
  const virtualModuleId = 'virtual:available-shots';
  const resolvedVirtualModuleId = '\0' + virtualModuleId;
  const shotsDir = fileURLToPath(new URL('./public/shots', import.meta.url));
  return {
    name: 'aurora-available-shots',
    resolveId(id) {
      if (id === virtualModuleId) return resolvedVirtualModuleId;
    },
    load(id) {
      if (id !== resolvedVirtualModuleId) return;
      let names: string[] = [];
      try {
        names = fs.readdirSync(shotsDir).filter((f) => f.toLowerCase().endsWith('.png'));
      } catch {
        names = [];
      }
      return `export const AVAILABLE_SHOTS = new Set(${JSON.stringify(names)});`;
    },
  };
}

/**
 * Phase 7 Lighthouse audit follow-up (2026-08-23, PageSpeed report
 * ypumoty04e): the mobile "Render-blocking requests" audit measured 810 ms
 * of estimated savings vs. only 200 ms on desktop for the *same* build
 * output — direct proof (dist/index.html) that `/assets/editor-*.css` (the
 * merged Tiptap/KaTeX chunk's CSS — see manualChunks above) is still an
 * unconditional `<link rel="stylesheet">` in the HTML on every page,
 * including the anonymous marketing landing page, costing ~330 ms of that
 * 810 ms on its own. This was NOT an accidental eager import: every module
 * under src/features/{editor,canvas,notes} is reached only through
 * App.tsx's lazy() routes (grepped and confirmed) — it's Vite's default CSS
 * handling, which, unlike JS (see `modulePreload.resolveDependencies`
 * below), has no per-chunk opt-out for statically injecting a chunk's CSS
 * into the HTML.
 *
 * The fix mirrors a pattern already shipped in this codebase for the four
 * optional font pairings (index.html's `#optional-fonts-preload` +
 * public/font-swap.js): rewrite the plain stylesheet link into a
 * `<link rel="preload" as="style" data-css-swap>` (fetched in parallel,
 * never blocking) plus a `<noscript>` fallback, and activate it once loaded
 * via public/css-swap.js. Every route that actually needs editor styling
 * still gets it — just fetched alongside the page instead of gating first
 * paint on it — while the ~95% of loads that never touch the editor, notes,
 * or canvas surfaces (every marketing visit, and most authenticated
 * sessions on any given load) stop paying for it.
 */
function deferEditorCss(): Plugin {
  return {
    name: 'aurora-defer-editor-css',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        const bundle = ctx.bundle;
        if (!bundle) return html;
        const editorCss = Object.values(bundle).find(
          (item) => item.type === 'asset' && /^assets\/editor-.*\.css$/.test(item.fileName)
        );
        if (!editorCss) return html;
        const href = `/${editorCss.fileName}`;
        const linkRe = new RegExp(
          `<link rel="stylesheet"[^>]*href="${href.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*>`
        );
        if (!linkRe.test(html)) return html;
        const replacement =
          `<link rel="preload" as="style" data-css-swap crossorigin href="${href}">` +
          `<noscript><link rel="stylesheet" crossorigin href="${href}"></noscript>`;
        html = html.replace(linkRe, replacement);
        if (!html.includes('/css-swap.js')) {
          html = html.replace('</head>', '<script src="/css-swap.js" defer></script></head>');
        }
        return html;
      },
    },
  };
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
        // Day/parchment (2026-08-23) — matches the new light-by-default brand
        // direction (src/lib/theme.ts's getInitialTheme) so the PWA install splash
        // screen and app-switcher chrome aren't a jarring dark flash before the
        // app's own light UI paints.
        theme_color: '#ECE4D6',
        background_color: '#ECE4D6',
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
    deferEditorCss(),
    availableShotsPlugin(),
  ],
  build: {
    rollupOptions: {
      output: { manualChunks },
    },
    // By default Vite injects a `<link rel="modulepreload">` in index.html
    // for every chunk reachable anywhere in the entry's dynamic-import graph
    // — not just ones actually needed on first paint. Phase 7 Lighthouse
    // audit (2026-08-23) traced the "526 KiB unused JavaScript" finding to
    // exactly this: `dist/index.html` unconditionally modulepreloads
    // canvas-*.js (Konva), editor-*.js (Tiptap/KaTeX), and vendor-*.js on
    // EVERY page load — including the public landing page, which never
    // imports any of that (App.tsx already lazy()-loads every authenticated
    // route; this was an HTML-level leak the route-splitting fix couldn't
    // touch). Filtering these three out of the auto-injected list means an
    // anonymous visitor's browser no longer eagerly fetches ~660 KiB of
    // editor/canvas/vendor JS it will very likely never execute; an
    // authenticated user's real route-level lazy() import still fetches
    // whichever of these it actually needs, just without the wasted
    // speculative preload on every other route too.
    modulePreload: {
      resolveDependencies: (_filename, deps) =>
        deps.filter((dep) => !/\/(canvas|editor|vendor)-/.test(dep)),
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
