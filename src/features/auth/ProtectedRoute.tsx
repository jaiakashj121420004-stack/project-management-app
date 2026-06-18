import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { FullScreenLoader } from './FullScreenLoader';

/** Gate for the authenticated app. Unauthenticated users are bounced to
 *  /login, remembering where they were headed. The real protection is RLS on
 *  the server — this is just navigation UX (plan.md §6). */
export function ProtectedRoute() {
  const { session, loading } = useAuth();
  const location = useLocation();

  if (loading) return <FullScreenLoader />;
  if (!session) return <Navigate to="/login" replace state={{ from: location }} />;
  return <Outlet />;
}
