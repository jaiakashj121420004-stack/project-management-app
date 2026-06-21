import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { PanelLeftClose, PanelLeftOpen, Plus } from 'lucide-react';
import { Brand } from './Brand';
import { SidebarNav } from './SidebarNav';
import { GradientButton } from '@/components/buttons/GradientButton';
import { springs } from '@/lib/motion';
import { cn } from '@/lib/cn';

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  drawerOpen: boolean;
  onCloseDrawer: () => void;
}

/** Inner content shared by the desktop rail and the mobile drawer. */
function Inner({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const navigate = useNavigate();

  function handleNewProject() {
    onNavigate?.();
    void navigate('/boards?new=1');
  }

  return (
    <div className="flex h-full flex-col gap-6 p-3">
      <div className={cn('px-1.5 pt-2', collapsed && 'flex justify-center px-0')}>
        <Brand collapsed={collapsed} />
      </div>

      <GradientButton
        size={collapsed ? 'sm' : 'md'}
        leftIcon={<Plus size={18} />}
        onClick={handleNewProject}
        className={cn('w-full', collapsed && 'aspect-square w-11 px-0')}
        aria-label="New project"
      >
        {!collapsed && 'New project'}
      </GradientButton>

      <SidebarNav collapsed={collapsed} onNavigate={onNavigate} />

      <div className="mt-auto px-1.5 text-xs leading-relaxed text-fg-subtle">
        {!collapsed && (
          <>
            <p>Aurora · v0.1</p>
            <p className="mt-0.5">
              Made by <span className="font-medium text-fg-muted">J. Jai Akash</span>
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export function Sidebar({
  collapsed,
  onToggleCollapsed,
  drawerOpen,
  onCloseDrawer,
}: SidebarProps) {
  return (
    <>
      {/* Desktop rail */}
      <aside
        className={cn(
          'glass relative z-20 hidden shrink-0 rounded-3xl transition-[width] duration-300 ease-spring md:block',
          collapsed ? 'w-[5.5rem]' : 'w-64',
        )}
      >
        <Inner collapsed={collapsed} />
        <button
          type="button"
          onClick={onToggleCollapsed}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="glass absolute -right-3 top-7 grid h-7 w-7 place-items-center rounded-full text-fg-muted transition-colors hover:text-fg"
        >
          {collapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
        </button>
      </aside>

      {/* Mobile drawer */}
      <AnimatePresence>
        {drawerOpen && (
          <div className="fixed inset-0 z-40 md:hidden">
            <motion.div
              className="absolute inset-0 bg-black/45 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onCloseDrawer}
            />
            <motion.aside
              className="glass-strong absolute inset-y-0 left-0 w-72 rounded-r-3xl pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pt-[env(safe-area-inset-top)]"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={springs.smooth}
            >
              <Inner collapsed={false} onNavigate={onCloseDrawer} />
            </motion.aside>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
