import { Navigate, Outlet, useLocation, type Location } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { FullScreenLoader } from './FullScreenLoader';

/** Gate for the auth screens. Already-authenticated users are sent into the
 *  app — back to wherever they were originally headed, if known. */
export function PublicOnlyRoute() {
  const { session, loading } = useAuth();
  const location = useLocation();

  if (loading) return <FullScreenLoader />;
  if (session) {
    const from = (location.state as { from?: Location } | null)?.from?.pathname ?? '/';
    return <Navigate to={from} replace />;
  }
  return <Outlet />;
}
