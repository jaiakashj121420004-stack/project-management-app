import type { Config } from 'tailwindcss';

/**
 * Aurora design tokens (plan.md §4). Colors are wired to CSS variables defined
 * in src/styles/index.css so the same utility classes flip between the
 * first-class light and dark themes. Glass surface values (whose alpha differs
 * per theme) live as component classes in the CSS, not here.
 */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Theme-reactive (channels set per theme in CSS).
        base: 'rgb(var(--bg) / <alpha-value>)',
        fg: 'rgb(var(--fg) / <alpha-value>)',
        'fg-muted': 'rgb(var(--fg-muted) / <alpha-value>)',
        'fg-subtle': 'rgb(var(--fg-subtle) / <alpha-value>)',
        // Oxblood accent + brand extras (flip per theme via CSS vars).
        ox: 'var(--ox)',
        'ox-bright': 'var(--ox-bright)',
        gilt: 'var(--gilt)',
        // Functional status colors — restrained, Almanac-compatible. All four
        // flip per theme via CSS vars so badge text clears AA in both themes
        // (the old fixed-hex success/info failed on the dark ink surface).
        success: 'var(--success)', // muted pine (done)
        warning: 'var(--gilt)', // gilt (due-soon)
        danger: 'var(--signal)', // signal oxblood-red (overdue)
        info: 'var(--info)', // umber (neutral info)
      },
      fontFamily: {
        display: ['Fraunces', 'Georgia', 'serif'],
        sans: ['Spectral', 'Georgia', 'serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        // Generous display scale (plan.md §4.3).
        display: ['clamp(2.75rem, 6vw, 5rem)', { lineHeight: '1.02', letterSpacing: '-0.03em' }],
        headline: ['clamp(2rem, 4vw, 3rem)', { lineHeight: '1.06', letterSpacing: '-0.02em' }],
        title: ['1.5rem', { lineHeight: '1.2', letterSpacing: '-0.01em' }],
      },
      // Radius scale is intentionally consolidated (Phase 3) to a small,
      // consistent set: `md` (0.5rem) for controls/inputs, `xl` (0.75rem) for
      // buttons/cards, `2xl` (1rem) for panels/menus/modals, plus `full` for
      // pills. The old ad-hoc `3xl`/`4xl` steps were removed and remapped to
      // `2xl` so surfaces stop mixing radii interchangeably.
      transitionTimingFunction: {
        spring: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
      keyframes: {
        'gradient-flow': {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        'spin-slow': {
          to: { transform: 'rotate(360deg)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
      },
      animation: {
        'gradient-flow': 'gradient-flow 6s ease-in-out infinite',
        'spin-slow': 'spin-slow 8s linear infinite',
        shimmer: 'shimmer 1.6s ease-in-out infinite',
        'fade-in': 'fade-in 0.4s ease both',
      },
    },
  },
  plugins: [],
} satisfies Config;
