import type { Config } from 'tailwindcss';

// The full Aurora design system (accent gradients, glass tokens, semantic
// colors, type scale) is implemented in Phase 1 — see plan.md §4. This is the
// minimal scaffold so the build works.
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {},
  },
  plugins: [],
} satisfies Config;
