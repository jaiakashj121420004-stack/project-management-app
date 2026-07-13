import { NavLink } from 'react-router-dom';
import { NAV_ITEMS } from './navItems';
import { cn } from '@/lib/cn';

/** Touch-friendly bottom navigation, shown only on small screens. */
export function BottomNav() {
  return (
    <nav className="glass-strong fixed bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-[max(0.75rem,env(safe-area-inset-left))] right-[max(0.75rem,env(safe-area-inset-right))] z-30 flex items-center justify-around rounded-3xl px-2 py-1.5 md:hidden">
      {NAV_ITEMS.filter((item) => item.bottomNav).map(({ label, to, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            cn(
              'relative flex flex-1 flex-col items-center gap-1 rounded-2xl py-2 text-[0.65rem] font-medium transition-colors',
              isActive ? 'text-fg' : 'text-fg-subtle',
            )
          }
        >
          {({ isActive }) => (
            <>
              <span
                className={cn(
                  'grid h-9 w-9 place-items-center rounded-2xl transition-all',
                  isActive &&
                    'bg-[linear-gradient(120deg,var(--accent-from),var(--accent-to))] text-[var(--accent-fg)] shadow-[0_8px_18px_-8px_var(--accent-glow)]',
                )}
              >
                <Icon size={19} strokeWidth={2.1} />
              </span>
              {label}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
