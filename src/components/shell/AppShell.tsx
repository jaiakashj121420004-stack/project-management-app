import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { AuroraBackground } from '@/components/AuroraBackground';
import { RouteErrorBoundary } from '@/components/feedback/RouteErrorBoundary';
import { OfflineBanner } from '@/components/pwa/OfflineBanner';
import { PWAReloadPrompt } from '@/components/pwa/PWAReloadPrompt';
import { useDueReminders } from '@/features/reminders';
import { CommandPalette } from '@/features/command-palette/CommandPalette';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { BottomNav } from './BottomNav';

/**
 * Responsive app frame: a collapsible glass sidebar (drawer on mobile), a top
 * bar, and a scrolling content area — all floating on the aurora background.
 * Pages render through the router <Outlet />.
 */
export function AppShell() {
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();

  // In-app due-date reminders (browser notifications) — opt-in, runs app-wide.
  useDueReminders();

  return (
    <div className="relative min-h-dvh">
      <AuroraBackground />

      <div className="mx-auto flex min-h-dvh w-full max-w-[1500px] gap-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] sm:pb-4 sm:pt-[max(1rem,env(safe-area-inset-top))] sm:pl-[max(1rem,env(safe-area-inset-left))] sm:pr-[max(1rem,env(safe-area-inset-right))]">
        <Sidebar
          collapsed={collapsed}
          onToggleCollapsed={() => setCollapsed((value) => !value)}
          drawerOpen={drawerOpen}
          onCloseDrawer={() => setDrawerOpen(false)}
        />

        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <Topbar onOpenMenu={() => setDrawerOpen(true)} />
          <main className="min-w-0 flex-1 pb-[calc(7rem+env(safe-area-inset-bottom))] md:pb-2">
            {/* Root crash boundary: a render error or failed lazy-chunk load in
                any page shows the inline fallback instead of white-screening the
                whole app, and recovers automatically when the route changes. */}
            <RouteErrorBoundary label="this page" resetKeys={[location.pathname]}>
              <Outlet />
            </RouteErrorBoundary>
          </main>
        </div>
      </div>

      <BottomNav />

      <OfflineBanner />
      <PWAReloadPrompt />
      <CommandPalette />
    </div>
  );
}
