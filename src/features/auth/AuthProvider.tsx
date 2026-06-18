import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { AuthContext, type AuthContextValue } from './auth-context';

/**
 * Owns the auth session. Restores it from storage on load, then keeps it in
 * sync via Supabase's `onAuthStateChange` (covers token refresh, sign-in,
 * sign-out, and OAuth/recovery redirects — supabase-js persists and refreshes
 * the session for us). Profile data is fetched separately via `useProfile`.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRecovery, setIsRecovery] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    let active = true;

    // Restore any persisted session before the first render settles.
    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
      if (event === 'PASSWORD_RECOVERY') setIsRecovery(true);
      if (event === 'SIGNED_OUT') {
        setIsRecovery(false);
        // Drop cached user-scoped data so nothing leaks to the next session.
        queryClient.clear();
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [queryClient]);

  const value = useMemo<AuthContextValue>(
    () => ({ session, user: session?.user ?? null, loading, isRecovery }),
    [session, loading, isRecovery],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
