import { Route, Routes } from 'react-router-dom';
import { AppShell } from '@/components/shell/AppShell';
import { Home } from '@/pages/Home';
import { StyleGuide } from '@/pages/StyleGuide';
import { Placeholder } from '@/pages/Placeholder';
import {
  ForgotPasswordPage,
  LoginPage,
  ProfilePage,
  ProtectedRoute,
  PublicOnlyRoute,
  ResetPasswordPage,
  SignUpPage,
} from '@/features/auth';

export default function App() {
  return (
    <Routes>
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
          <Route index element={<Home />} />
          <Route path="calendar" element={<Placeholder title="Calendar" phase="Phase 6" />} />
          <Route path="notes" element={<Placeholder title="Notes" phase="Phase 7" />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="style-guide" element={<StyleGuide />} />
          <Route path="*" element={<Placeholder title="Not found" phase="a future phase" />} />
        </Route>
      </Route>
    </Routes>
  );
}
