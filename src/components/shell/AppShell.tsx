import { useState } from 'react';
import { Outlet, useLocation, useMatch } from 'react-router-dom';
import { AuroraBackground } from '@/components/AuroraBackground';
import { RouteErrorBoundary } from '@/components/feedback/RouteErrorBoundary';
import { OfflineBanner } from '@/components/pwa/OfflineBanner';
import { PWAReloadPrompt } from '@/components/pwa/PWAReloadPrompt';
import { useDueReminders } from '@/features/reminders';
import { CommandPalette } from '@/features/command-palette/CommandPalette';
import { useProject } from '@/features/projects/useProjects';
import { accentVarsWithBrand } from '@/lib/accents';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { BottomNav } from './BottomNav';
import { OnboardingTour, hasSeenOnboarding } from './OnboardingTour';

/**
 * Responsive app frame: a collapsible glass sidebar (drawer on mobile), a top
 * bar, and a scrolling content area — all floating on the aurora background.
 * Pages render through the router <Outlet />.
 */
export function AppShell() {
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(() => !hasSeenOnboarding());
  const location = useLocation();

  // In-app due-date reminders (browser notifications) — opt-in, runs app-wide.
  useDueReminders();

  // Full immersive per-project accent theming: while viewing a project, the
  // whole shell (sidebar, top bar, brand mark/wordmark, nav active states,
  // buttons) adopts that project's accent instead of just the project page's
  // own content. `useProject` reads the same ['project', id] TanStack cache
  // ProjectPage.tsx uses, so this costs no extra fetch and resolves in the
  // same render pass — including on a hard refresh straight into a project
  // URL, so it shows that project's color immediately rather than flashing
  // oxblood first. Off a project route (or before it's loaded) `activeProject`
  // is undefined, so no style is applied and the shell falls back to the
  // theme root's default oxblood — the correct "reverted" state.
  const projectMatch = useMatch('/projects/:projectId');
  const { data: activeProject } = useProject(projectMatch?.params.projectId);
  const accentStyle = activeProject ? accentVarsWithBrand(activeProject.accent) : undefined;

  return (
    <div className="accent-scope relative h-dvh overflow-hidden" style={accentStyle}>
      {/* Keyboard/AT users can jump straight past the sidebar + top bar to the
          main content. Visually hidden until focused. */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-xl focus:border focus:border-[var(--glass-border)] focus:bg-[var(--glass-fill-strong)] focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-fg focus:shadow-[var(--glass-shadow)] focus:backdrop-blur-xl"
      >
        Skip to content
      </a>

      <AuroraBackground />

      {/* The shell itself is pinned to the viewport height (h-dvh + overflow-
          hidden) so the sidebar and top bar never scroll away — only <main>
          below scrolls internally. Previously this row had no height cap, so
          the whole page (sidebar + top bar + content) scrolled together and
          the top bar slid out of view on any page taller than the viewport. */}
      <div className="mx-auto flex h-dvh w-full max-w-[1500px] gap-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] sm:pb-4 sm:pt-[max(1rem,env(safe-area-inset-top))] sm:pl-[max(1rem,env(safe-area-inset-left))] sm:pr-[max(1rem,env(safe-area-inset-right))]">
        <Sidebar
          collapsed={collapsed}
          onToggleCollapsed={() => setCollapsed((value) => !value)}
          drawerOpen={drawerOpen}
          onCloseDrawer={() => setDrawerOpen(false)}
        />

        <div className="flex min-w-0 flex-1 flex-col gap-4 overflow-hidden">
          <Topbar onOpenMenu={() => setDrawerOpen(true)} />
          <main
            id="main-content"
            tabIndex={-1}
            className="min-w-0 flex-1 scroll-mt-4 overflow-y-auto pb-[calc(7rem+env(safe-area-inset-bottom))] outline-none md:pb-2"
          >
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
      {showOnboarding && <OnboardingTour onDone={() => setShowOnboarding(false)} />}
    </div>
  );
}
