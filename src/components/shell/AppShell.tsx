import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { AuroraBackground } from '@/components/AuroraBackground';
import { OfflineBanner } from '@/components/pwa/OfflineBanner';
import { PWAReloadPrompt } from '@/components/pwa/PWAReloadPrompt';
import { useDueReminders } from '@/features/reminders';
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

  // In-app due-date reminders (browser notifications) — opt-in, runs app-wide.
  useDueReminders();

  return (
    <div className="relative min-h-dvh">
      <AuroraBackground />

      <div className="mx-auto flex min-h-dvh w-full max-w-[1500px] gap-4 p-3 sm:p-4">
        <Sidebar
          collapsed={collapsed}
          onToggleCollapsed={() => setCollapsed((value) => !value)}
          drawerOpen={drawerOpen}
          onCloseDrawer={() => setDrawerOpen(false)}
        />

        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <Topbar onOpenMenu={() => setDrawerOpen(true)} />
          <main className="min-w-0 flex-1 pb-24 md:pb-2">
            <Outlet />
          </main>
        </div>
      </div>

      <BottomNav />

      <OfflineBanner />
      <PWAReloadPrompt />
    </div>
  );
}
