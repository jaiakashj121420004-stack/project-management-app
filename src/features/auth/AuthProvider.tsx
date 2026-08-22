import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { clearPersistedCache } from '@/lib/queryClient';
import { markSignupCompletedIfGoogleIntent } from '@/lib/analytics';
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
      // Closes the Google-signup tracking gap documented in SignUpPage's
      // onGoogle() — this is the one place in the app that sees every
      // sign-in, redirect-based or not. A no-op unless this browser set the
      // "Google signup in flight" flag within the last 5 minutes AND the
      // account itself is that fresh; see the doc comment on
      // markSignupCompletedIfGoogleIntent for why both checks are needed.
      if (event === 'SIGNED_IN' && nextSession?.user) {
        markSignupCompletedIfGoogleIntent(nextSession.user.created_at);
      }
      if (event === 'SIGNED_OUT') {
        setIsRecovery(false);
        // Drop in-memory AND persisted user-scoped data so nothing leaks to the
        // next session (the cache is persisted to localStorage in Phase 9).
        clearPersistedCache();
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ session, user: session?.user ?? null, loading, isRecovery }),
    [session, loading, isRecovery],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
