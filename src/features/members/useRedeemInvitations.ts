import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { redeemMyInvitations } from './api';

/**
 * On sign-in, claim any invitations addressed to this user's email and resolve
 * them into memberships, then refresh the project list so newly-joined projects
 * appear without a manual reload. Brand-new users are auto-redeemed by a DB
 * trigger at sign-up; this covers people who were already registered when they
 * were invited. Runs once per user id (a ref guards against repeat calls on
 * re-render); a failure clears the guard so a later mount can retry.
 */
export function useRedeemInvitations() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const redeemedFor = useRef<string | null>(null);
  const userId = user?.id;

  useEffect(() => {
    if (!userId || redeemedFor.current === userId) return;
    redeemedFor.current = userId;
    void redeemMyInvitations()
      .then((count) => {
        if (count > 0) void queryClient.invalidateQueries({ queryKey: ['projects'] });
      })
      .catch(() => {
        redeemedFor.current = null;
      });
  }, [userId, queryClient]);
}
