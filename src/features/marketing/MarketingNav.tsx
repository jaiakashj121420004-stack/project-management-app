import { Link } from 'react-router-dom';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { Brand } from '@/components/shell/Brand';
import { MarketingButton } from './MarketingButton';

/** Anchor links resolve to sections on the landing page; Pricing is its own route. */
const NAV_LINKS = [
  { label: 'Features', href: '/#features' },
  { label: 'Showcase', href: '/#showcase' },
  { label: 'Pricing', href: '/pricing' },
] as const;

/**
 * Sticky frosted top navigation shared across every public page. Collapses the
 * inline link list on small screens (the CTAs stay reachable), keeping the bar
 * usable on mobile without a hamburger menu.
 */
export function MarketingNav() {
  return (
    <header className="sticky top-0 z-30 px-4 pt-3 sm:px-6">
      <nav className="glass mx-auto flex max-w-6xl items-center gap-3 rounded-2xl px-3 py-2.5 sm:px-4">
        <Link to="/" aria-label="Aurora home" className="rounded-xl">
          <Brand />
        </Link>

        <div className="ml-2 hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              to={link.href}
              className="rounded-xl px-3 py-1.5 text-sm font-medium text-fg-muted transition-colors hover:bg-[var(--glass-fill)] hover:text-fg"
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          <Link
            to="/login"
            className="hidden rounded-2xl px-3 py-2 text-sm font-medium text-fg-muted transition-colors hover:bg-[var(--glass-fill)] hover:text-fg sm:inline-flex"
          >
            Log in
          </Link>
          <MarketingButton to="/signup" size="sm">
            Get started
          </MarketingButton>
        </div>
      </nav>
    </header>
  );
}
