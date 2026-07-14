import { Menu, Search } from 'lucide-react';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { UserMenu } from '@/features/auth';
import { NotificationBell } from '@/features/collaboration';
import { openCommandPalette } from '@/features/command-palette/paletteStore';
import { cn } from '@/lib/cn';

/** App top bar: mobile menu trigger, a search affordance, theme toggle, avatar. */
export function Topbar({ onOpenMenu }: { onOpenMenu: () => void }) {
  return (
    <header className="glass z-20 flex h-16 items-center gap-3 rounded-2xl px-3 sm:px-4">
      <button
        type="button"
        onClick={onOpenMenu}
        aria-label="Open menu"
        className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-fg-muted transition-colors hover:bg-[var(--glass-fill)] hover:text-fg md:hidden"
      >
        <Menu size={20} />
      </button>

      <button
        type="button"
        onClick={openCommandPalette}
        aria-label="Search — open the command palette"
        aria-keyshortcuts="Meta+K Control+K"
        className={cn(
          'flex h-11 min-w-0 flex-1 items-center gap-2.5 rounded-xl border bg-[var(--field-bg)] px-3.5 leading-none',
          'text-left text-sm text-fg-subtle transition-colors hover:text-fg-muted',
          'max-w-md',
        )}
      >
        <Search size={17} className="shrink-0" />
        <span className="truncate">
          <span className="sm:hidden">Search…</span>
          <span className="hidden sm:inline">Search projects, cards, notes…</span>
        </span>
        <kbd className="ml-auto hidden shrink-0 rounded bg-[var(--glass-fill)] px-1.5 py-0.5 font-mono text-[10px] text-fg-subtle sm:block">
          ⌘K
        </kbd>
      </button>

      <div className="ml-auto flex items-center gap-2.5">
        <NotificationBell />
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  );
}
