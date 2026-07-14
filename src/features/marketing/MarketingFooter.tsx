import { Link } from 'react-router-dom';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { Brand } from '@/components/shell/Brand';

interface FooterColumn {
  heading: string;
  links: { label: string; to: string }[];
}

const FOOTER_COLUMNS: FooterColumn[] = [
  {
    heading: 'Product',
    links: [
      { label: 'Features', to: '/#features' },
      { label: 'Showcase', to: '/#showcase' },
      { label: 'Pricing', to: '/pricing' },
    ],
  },
  {
    heading: 'Legal',
    links: [
      { label: 'Terms', to: '/terms' },
      { label: 'Privacy', to: '/privacy' },
    ],
  },
  {
    heading: 'Account',
    links: [
      { label: 'Log in', to: '/login' },
      { label: 'Sign up', to: '/signup' },
    ],
  },
];

/** Public-site footer: wordmark + tagline, link columns, theme toggle, copyright. */
export function MarketingFooter() {
  return (
    <footer className="px-4 pb-10 pt-20 sm:px-6">
      <div className="glass mx-auto max-w-6xl rounded-2xl p-8 sm:p-10">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div className="max-w-xs">
            <Brand />
            <p className="mt-4 text-sm leading-relaxed text-fg-muted">
              The project workspace that feels like magic. Boards, calendar, notes and
              reminders — beautifully in one place.
            </p>
            <div className="mt-5">
              <ThemeToggle />
            </div>
          </div>

          {FOOTER_COLUMNS.map((column) => (
            <nav key={column.heading} aria-label={column.heading}>
              <h2 className="font-display text-sm font-semibold text-fg">{column.heading}</h2>
              <ul className="mt-4 flex flex-col gap-2.5">
                {column.links.map((link) => (
                  <li key={link.to + link.label}>
                    <Link
                      to={link.to}
                      className="text-sm text-fg-muted underline-offset-4 transition-colors hover:text-fg hover:underline"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-10 border-t border-[var(--hairline)] pt-6 text-sm text-fg-subtle">
          © 2026 Aurora
        </div>
      </div>
    </footer>
  );
}
