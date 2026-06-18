import { NavLink } from 'react-router-dom';
import { NAV_ITEMS } from './navItems';
import { cn } from '@/lib/cn';

/** Touch-friendly bottom navigation, shown only on small screens. */
export function BottomNav() {
  return (
    <nav className="glass-strong glass-edge fixed inset-x-3 bottom-3 z-30 flex items-center justify-around rounded-[26px] px-2 py-1.5 md:hidden">
      {NAV_ITEMS.map(({ label, to, icon: Icon, end }) => (
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
                  'grid h-9 w-9 place-items-center rounded-2xl transition-all duration-200',
                  isActive &&
                    'bg-[linear-gradient(120deg,var(--accent-from),var(--accent-to))] text-white shadow-[0_10px_20px_-8px_var(--accent-glow)] ring-1 ring-white/20',
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
