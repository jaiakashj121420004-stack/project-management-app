import { createContext } from 'react';
import type { Session, User } from '@supabase/supabase-js';

export interface AuthContextValue {
  /** The active Supabase session, or null when signed out. */
  session: Session | null;
  /** Convenience accessor for `session.user`. */
  user: User | null;
  /** True while the initial session is being restored from storage. */
  loading: boolean;
  /** True when the user arrived via a password-recovery link. */
  isRecovery: boolean;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
