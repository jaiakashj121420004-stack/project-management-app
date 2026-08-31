import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
// Own files, not the '@/features/auth' barrel — see main.tsx's AuthProvider
// import for why: a barrel import here would statically pull LoginPage /
// SignUpPage / ForgotPasswordPage / ResetPasswordPage / ProfilePage back into
// this eagerly-loaded module, defeating their lazy() split below.
import { ProtectedRoute } from '@/features/auth/ProtectedRoute';
import { PublicOnlyRoute } from '@/features/auth/PublicOnlyRoute';
import { LandingPage, PricingPage, TermsPage, PrivacyPage } from '@/features/marketing';
import { FullScreenLoader } from '@/features/auth/FullScreenLoader';

/**
 * Everything below is code-split from the initial bundle: anonymous visitors
 * to "/" (the marketing landing page) previously downloaded the entire
 * authenticated app — boards, calendar, canvas, billing, admin analytics,
 * every auth screen — because App.tsx imported it all eagerly at the top of
 * the module graph (Phase 7 Lighthouse audit, 2026-08-23: ~526 KiB of unused
 * JS on the landing page). Each of these is now a separate chunk fetched only
 * when its route is actually visited.
 *
 * Imported from the page's own file, not the feature's barrel `index.ts` —
 * importing via the barrel would still pull in every sibling export that
 * barrel re-exports (e.g. `@/features/auth`'s barrel also statically imports
 * ProtectedRoute/PublicOnlyRoute, which we need eagerly for the route tree
 * itself), so a dynamic import of the barrel wouldn't actually split anything.
 */
const AppShell = lazy(() =>
  import('@/components/shell/AppShell').then((m) => ({ default: m.AppShell }))
);
const TodayPage = lazy(() =>
  import('@/features/today/TodayPage').then((m) => ({ default: m.TodayPage }))
);
const ProjectsPage = lazy(() =>
  import('@/features/projects/ProjectsPage').then((m) => ({ default: m.ProjectsPage }))
);
const ProjectPage = lazy(() =>
  import('@/features/projects/ProjectPage').then((m) => ({ default: m.ProjectPage }))
);
const CalendarPage = lazy(() =>
  import('@/features/calendar/CalendarPage').then((m) => ({ default: m.CalendarPage }))
);
const TodosPage = lazy(() =>
  import('@/features/todos/TodosPage').then((m) => ({ default: m.TodosPage }))
);
const LibraryPage = lazy(() =>
  import('@/features/library/LibraryPage').then((m) => ({ default: m.LibraryPage }))
);
const CeoMessagePage = lazy(() =>
  import('@/features/announcements/CeoMessagePage').then((m) => ({ default: m.CeoMessagePage }))
);
const FeedbackPage = lazy(() =>
  import('@/features/feedback/FeedbackPage').then((m) => ({ default: m.FeedbackPage }))
);
const AnalyticsDashboard = lazy(() =>
  import('@/features/admin-analytics/AnalyticsDashboard').then((m) => ({
    default: m.AnalyticsDashboard,
  }))
);
const BillingPage = lazy(() =>
  import('@/features/billing/BillingPage').then((m) => ({ default: m.BillingPage }))
);
const ProVsFreePage = lazy(() =>
  import('@/features/billing/ProVsFreePage').then((m) => ({ default: m.ProVsFreePage }))
);
const SharedProjectPage = lazy(() =>
  import('@/features/project-share/SharedProjectPage').then((m) => ({
    default: m.SharedProjectPage,
  }))
);
const ForgotPasswordPage = lazy(() =>
  import('@/features/auth/ForgotPasswordPage').then((m) => ({ default: m.ForgotPasswordPage }))
);
const LoginPage = lazy(() =>
  import('@/features/auth/LoginPage').then((m) => ({ default: m.LoginPage }))
);
const SignUpPage = lazy(() =>
  import('@/features/auth/SignUpPage').then((m) => ({ default: m.SignUpPage }))
);
const ResetPasswordPage = lazy(() =>
  import('@/features/auth/ResetPasswordPage').then((m) => ({ default: m.ResetPasswordPage }))
);
const ProfilePage = lazy(() =>
  import('@/features/auth/ProfilePage').then((m) => ({ default: m.ProfilePage }))
);
const SettingsPage = lazy(() =>
  import('@/pages/SettingsPage').then((m) => ({ default: m.SettingsPage }))
);
const ContactPage = lazy(() =>
  import('@/features/support/ContactPage').then((m) => ({ default: m.ContactPage }))
);
const StyleGuide = lazy(() =>
  import('@/pages/StyleGuide').then((m) => ({ default: m.StyleGuide }))
);
const Placeholder = lazy(() =>
  import('@/pages/Placeholder').then((m) => ({ default: m.Placeholder }))
);

/** The root path: the public marketing landing page for signed-out visitors;
 *  signed-in users are sent straight to their boards. */
function RootRoute() {
  const { session, loading } = useAuth();
  if (loading) return <FullScreenLoader />;
  return session ? <Navigate to="/boards" replace /> : <LandingPage />;
}

export default function App() {
  return (
    <Suspense fallback={<FullScreenLoader />}>
      <Routes>
        {/* Public marketing — open to everyone, no app shell. */}
        <Route path="/" element={<RootRoute />} />
        {/* Always renders the landing page, even when signed in — for previewing
            the marketing site without logging out. */}
        <Route path="/preview" element={<LandingPage />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        {/* Public read-only board share link — no login, no app shell. Its own
            minimal chrome (see SharedProjectPage) so nothing else on this route
            leads to billing/settings/member surfaces. */}
        <Route path="/share/:token" element={<SharedProjectPage />} />

        {/* Auth screens — only for signed-out visitors. */}
        <Route element={<PublicOnlyRoute />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignUpPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        </Route>

        {/* Completes a password reset; reachable via the emailed recovery link. */}
        <Route path="/reset-password" element={<ResetPasswordPage />} />

        {/* The authenticated app. */}
        <Route element={<ProtectedRoute />}>
          <Route element={<AppShell />}>
            <Route path="today" element={<TodayPage />} />
            <Route path="boards" element={<ProjectsPage />} />
            <Route path="projects/:projectId" element={<ProjectPage />} />
            <Route path="calendar" element={<CalendarPage />} />
            <Route path="todos" element={<TodosPage />} />
            <Route path="library" element={<LibraryPage />} />
            {/* The old global Notes + Canvas destinations now live in the Library.
                Redirect legacy links / PWA shortcuts so nothing 404s. */}
            <Route path="notes" element={<Navigate to="/library" replace />} />
            <Route path="canvas" element={<Navigate to="/library" replace />} />
            <Route path="from-the-founder" element={<CeoMessagePage />} />
            <Route path="feedback" element={<FeedbackPage />} />
            <Route path="analytics" element={<AnalyticsDashboard />} />
            <Route path="billing" element={<BillingPage />} />
            <Route path="pro-vs-free" element={<ProVsFreePage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="contact" element={<ContactPage />} />
            <Route path="settings" element={<SettingsPage />} />
            {/* Dev-only component showcase — intentionally not in the nav; kept
                reachable by direct URL for verifying primitives in both themes. */}
            <Route path="style-guide" element={<StyleGuide />} />
            <Route path="*" element={<Placeholder title="Not found" phase="a future phase" />} />
          </Route>
        </Route>
      </Routes>
    </Suspense>
  );
}
