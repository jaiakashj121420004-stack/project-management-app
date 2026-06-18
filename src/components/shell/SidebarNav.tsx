import { NavLink } from 'react-router-dom';
import { NAV_ITEMS } from './navItems';
import { cn } from '@/lib/cn';

/** The nav links, shared by the desktop sidebar and the mobile drawer. */
export function SidebarNav({
  collapsed = false,
  onNavigate,
}: {
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <nav className="flex flex-col gap-1.5">
      {NAV_ITEMS.map(({ label, to, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onNavigate}
          title={collapsed ? label : undefined}
          className={({ isActive }) =>
            cn(
              'group relative flex items-center gap-3 rounded-2xl px-3.5 py-2.5',
              'text-sm font-medium transition-colors duration-200',
              collapsed && 'justify-center px-0',
              isActive
                ? 'text-white'
                : 'text-fg-muted hover:bg-[var(--glass-fill)] hover:text-fg',
            )
          }
        >
          {({ isActive }) => (
            <>
              {isActive && (
                <span
                  aria-hidden
                  className="absolute inset-0 -z-10 rounded-2xl bg-[length:220%_auto] bg-[linear-gradient(110deg,var(--accent-from),var(--accent-to),var(--accent-from))] shadow-[0_10px_24px_-12px_var(--accent-glow)] motion-safe:animate-gradient-flow"
                />
              )}
              <Icon size={19} strokeWidth={2.1} className="shrink-0" />
              {!collapsed && <span>{label}</span>}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
