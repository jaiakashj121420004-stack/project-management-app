import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from '@/components/shell/AppShell';
import { StyleGuide } from '@/pages/StyleGuide';
import { Placeholder } from '@/pages/Placeholder';
import { useAuth } from '@/hooks/useAuth';
import { ProjectsPage, ProjectPage } from '@/features/projects';
import { CalendarPage } from '@/features/calendar';
import { TodosPage } from '@/features/todos';
import { NotesHome } from '@/features/notes';
import { BillingPage } from '@/features/billing';
import { CeoMessagePage } from '@/features/announcements';
import { FeedbackPage } from '@/features/feedback';
import { LandingPage, PricingPage, TermsPage, PrivacyPage } from '@/features/marketing';
import {
  ForgotPasswordPage,
  LoginPage,
  ProfilePage,
  ProtectedRoute,
  PublicOnlyRoute,
  ResetPasswordPage,
  SignUpPage,
} from '@/features/auth';
import { FullScreenLoader } from '@/features/auth/FullScreenLoader';

/** The root path: the public marketing landing page for signed-out visitors;
 *  signed-in users are sent straight to their boards. */
function RootRoute() {
  const { session, loading } = useAuth();
  if (loading) return <FullScreenLoader />;
  return session ? <Navigate to="/boards" replace /> : <LandingPage />;
}

export default function App() {
  return (
    <Routes>
      {/* Public marketing — open to everyone, no app shell. */}
      <Route path="/" element={<RootRoute />} />
      <Route path="/pricing" element={<PricingPage />} />
      <Route path="/terms" element={<TermsPage />} />
      <Route path="/privacy" element={<PrivacyPage />} />

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
          <Route path="boards" element={<ProjectsPage />} />
          <Route path="projects/:projectId" element={<ProjectPage />} />
          <Route path="calendar" element={<CalendarPage />} />
          <Route path="todos" element={<TodosPage />} />
          <Route path="notes" element={<NotesHome />} />
          <Route path="from-the-founder" element={<CeoMessagePage />} />
          <Route path="feedback" element={<FeedbackPage />} />
          <Route path="billing" element={<BillingPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="style-guide" element={<StyleGuide />} />
          <Route path="*" element={<Placeholder title="Not found" phase="a future phase" />} />
        </Route>
      </Route>
    </Routes>
  );
}
