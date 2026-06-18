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
        // Fixed semantic colors (plan.md §4.2).
        success: '#10B981',
        warning: '#F59E0B',
        danger: '#EF4444',
        info: '#06B6D4',
      },
      fontFamily: {
        display: ['"Space Grotesk Variable"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans: ['"Inter Variable"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        // Generous display scale (plan.md §4.3).
        display: ['clamp(2.75rem, 6vw, 5rem)', { lineHeight: '1.02', letterSpacing: '-0.03em' }],
        headline: ['clamp(2rem, 4vw, 3rem)', { lineHeight: '1.06', letterSpacing: '-0.02em' }],
        title: ['1.5rem', { lineHeight: '1.2', letterSpacing: '-0.01em' }],
      },
      borderRadius: {
        '4xl': '2rem',
      },
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
