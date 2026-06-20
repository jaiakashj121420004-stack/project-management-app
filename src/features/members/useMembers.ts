import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import type { Invitation, InvitationRole, ProjectRole } from '@/types/database';
import {
  cancelInvitation,
  fetchInvitations,
  fetchMembers,
  inviteMember,
  removeMember,
  updateMemberRole,
  type MemberWithProfile,
} from './api';

/**
 * A project's collaboration state lives in one cache entry,
 * `['members', projectId]` → { members, invitations } — the same one-snapshot
 * strategy as the board and notes. Realtime invalidates this key when a
 * project_members row changes, so role edits and removals stream in live; the
 * mutations below patch the snapshot optimistically for an instant local feel.
 */

export interface MembersData {
  members: MemberWithProfile[];
  invitations: Invitation[];
}

const membersKey = (projectId: string): QueryKey => ['members', projectId];

interface MembersContext {
  previous?: MembersData;
}

export function useMembers(projectId: string | undefined) {
  return useQuery({
    queryKey: membersKey(projectId ?? ''),
    enabled: Boolean(projectId),
    queryFn: async (): Promise<MembersData> => {
      const [members, invitations] = await Promise.all([
        fetchMembers(projectId as string),
        fetchInvitations(projectId as string),
      ]);
      return { members, invitations };
    },
  });
}

/** The current user's role in a project, or null if not a member / still loading. */
export function useMyRole(projectId: string | undefined): ProjectRole | null {
  const { user } = useAuth();
  const { data } = useMembers(projectId);
  if (!data || !user) return null;
  return data.members.find((member) => member.userId === user.id)?.role ?? null;
}

/** Shared optimistic plumbing: snapshot → patch → rollback-on-error → refetch. */
function useMembersMutation<TData, TVariables>(
  projectId: string,
  mutationFn: (variables: TVariables) => Promise<TData>,
  patch?: (data: MembersData, variables: TVariables) => MembersData,
) {
  const queryClient = useQueryClient();
  const key = membersKey(projectId);

  return useMutation<TData, Error, TVariables, MembersContext>({
    mutationFn,
    onMutate: async (variables) => {
      if (!patch) return {};
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<MembersData>(key);
      queryClient.setQueryData<MembersData>(key, (old) => (old ? patch(old, variables) : old));
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: key });
    },
  });
}

export function useInviteMember(projectId: string) {
  const { user } = useAuth();
  return useMembersMutation<Invitation, { email: string; role: InvitationRole }>(
    projectId,
    ({ email, role }) => {
      if (!user) throw new Error('You must be signed in.');
      return inviteMember({ projectId, email, role, invitedBy: user.id });
    },
  );
}

export function useUpdateMemberRole(projectId: string) {
  return useMembersMutation<void, { userId: string; role: InvitationRole }>(
    projectId,
    ({ userId, role }) => updateMemberRole(projectId, userId, role),
    (data, { userId, role }) => ({
      ...data,
      members: data.members.map((member) =>
        member.userId === userId ? { ...member, role } : member,
      ),
    }),
  );
}

export function useRemoveMember(projectId: string) {
  return useMembersMutation<void, { userId: string }>(
    projectId,
    ({ userId }) => removeMember(projectId, userId),
    (data, { userId }) => ({
      ...data,
      members: data.members.filter((member) => member.userId !== userId),
    }),
  );
}

export function useCancelInvitation(projectId: string) {
  return useMembersMutation<void, { id: string }>(
    projectId,
    ({ id }) => cancelInvitation(id),
    (data, { id }) => ({
      ...data,
      invitations: data.invitations.filter((invitation) => invitation.id !== id),
    }),
  );
}
