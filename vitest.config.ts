import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Dedicated Vitest config (kept separate from vite.config.ts so the PWA plugin
// never runs under tests). Mirrors the app's `@` alias and adds a jsdom
// environment + jest-dom matchers for future component tests. The first suites
// (Phase 2) target the pure-logic modules, but the DOM harness is ready.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    css: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      // Report coverage on the pure-logic modules the first suites exercise.
      include: [
        'src/features/board/ordering.ts',
        'src/lib/dueAt.ts',
        'src/lib/contrast.ts',
        'src/hooks/useFocusTrap.ts',
        'src/features/editor/serialize.ts',
        'src/features/library/tree.ts',
        'src/features/canvas/collab/yCanvasDoc.ts',
      ],
    },
  },
});
