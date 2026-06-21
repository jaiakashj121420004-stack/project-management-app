import { Menu, Search } from 'lucide-react';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { UserMenu } from '@/features/auth';
import { cn } from '@/lib/cn';

/** App top bar: mobile menu trigger, a search affordance, theme toggle, avatar. */
export function Topbar({ onOpenMenu }: { onOpenMenu: () => void }) {
  return (
    <header className="glass z-20 flex h-16 items-center gap-3 rounded-3xl px-3 sm:px-4">
      <button
        type="button"
        onClick={onOpenMenu}
        aria-label="Open menu"
        className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl text-fg-muted transition-colors hover:bg-[var(--glass-fill)] hover:text-fg md:hidden"
      >
        <Menu size={20} />
      </button>

      <button
        type="button"
        className={cn(
          'flex h-11 flex-1 items-center gap-2.5 rounded-2xl border bg-[var(--field-bg)] px-3.5 leading-none',
          'text-left text-sm text-fg-subtle transition-colors hover:text-fg-muted',
          'max-w-md',
        )}
      >
        <Search size={17} />
        <span>Search projects, cards, notes…</span>
      </button>

      <div className="ml-auto flex items-center gap-2.5">
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  );
}
