import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { acceptInvitation, declineInvitation, fetchMyInvitations, removeMember } from './api';

/**
 * Hooks for the accept/decline invitation flow (invites no longer auto-join —
 * see migration 20260621180000). `['my-invitations']` holds the current user's
 * pending invites across all projects.
 */

const MY_INVITATIONS_KEY = ['my-invitations'] as const;

/** Pending invitations addressed to the current user. */
export function useMyInvitations() {
  return useQuery({
    queryKey: MY_INVITATIONS_KEY,
    queryFn: fetchMyInvitations,
  });
}

/** Accept an invitation → join the project. Refreshes invites + project list. */
export function useAcceptInvitation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (invitationId: string) => acceptInvitation(invitationId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: MY_INVITATIONS_KEY });
      void queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}

/** Decline (delete) an invitation addressed to me. */
export function useDeclineInvitation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (invitationId: string) => declineInvitation(invitationId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: MY_INVITATIONS_KEY });
    },
  });
}

/** Leave a project (delete my own membership). Refreshes the project list. */
export function useLeaveProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, userId }: { projectId: string; userId: string }) =>
      removeMember(projectId, userId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}
