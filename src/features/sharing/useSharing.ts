import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import {
  fetchCollaborators,
  fetchMyRole,
  removeCollaborator,
  setCollaboratorRole,
  shareTarget,
  type ShareKind,
  type ShareRole,
} from './api';

/** Cache + mutations for a canvas/note's collaborator list. Every write
 *  invalidates the list so the roster stays authoritative (RLS-scoped). */
export function useSharing(kind: ShareKind, targetId: string) {
  const queryClient = useQueryClient();
  const key = ['collaborators', kind, targetId];
  const invalidate = () => void queryClient.invalidateQueries({ queryKey: key });

  const collaborators = useQuery({
    queryKey: key,
    queryFn: () => fetchCollaborators(kind, targetId),
    enabled: Boolean(targetId),
  });

  const share = useMutation({
    mutationFn: (vars: { email: string; role: ShareRole }) =>
      shareTarget(kind, targetId, vars.email, vars.role),
    onSuccess: invalidate,
  });

  const setRole = useMutation({
    mutationFn: (vars: { userId: string; role: ShareRole }) =>
      setCollaboratorRole(kind, targetId, vars.userId, vars.role),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (vars: { userId: string }) => removeCollaborator(kind, targetId, vars.userId),
    onSuccess: invalidate,
  });

  return { collaborators, share, setRole, remove };
}

/**
 * The current user's actual access to a shared canvas/note — the owner always
 * gets 'owner' (full edit); anyone else gets their real `canvas_members` /
 * `note_members` row ('editor' | 'viewer'), or null if they have no row (no
 * access — the item wouldn't have loaded for them in the first place). Backs
 * `canEdit` for standalone notes and personal canvases opened via the Library
 * or the /canvas workspace, so a viewer actually gets read-only UI instead of
 * every collaborator being treated as a full editor (or, for canvas, instead
 * of being gated on the VIEWER's own Pro plan, which has nothing to do with
 * whether they were shared editor or viewer access).
 *
 * Subscribes to postgres_changes on the relevant member row so a role change
 * (editor → viewer or back) applies live, without a reload — RLS still lets
 * the affected user see their own membership row change (they remain a
 * member, just with a different role), so this event reliably arrives. An
 * outright removal can't be relied on to notify the removed user this way
 * (by the time the DELETE fires, RLS no longer lets them see the row) — same
 * known limitation `useProjectRealtime` already has for project removals;
 * their next natural refetch (focus/mount) drops the item once they can no
 * longer read it, and every write attempt is blocked at the DB immediately
 * regardless of what the client cache still shows.
 */
export function useSharedItemRole(kind: ShareKind, targetId: string, ownerId: string | null) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isOwner = Boolean(user && ownerId === user.id);
  const enabled = Boolean(targetId && user && !isOwner);
  const key = ['my-role', kind, targetId, user?.id];

  const query = useQuery({
    queryKey: key,
    queryFn: () => {
      if (!user) throw new Error('Not signed in.');
      return fetchMyRole(kind, targetId, user.id);
    },
    enabled,
  });

  useEffect(() => {
    if (!enabled) return;
    const table = kind === 'canvas' ? 'canvas_members' : 'note_members';
    const idColumn = kind === 'canvas' ? 'canvas_id' : 'note_id';
    const channel = supabase
      .channel(`${table}:${targetId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table, filter: `${idColumn}=eq.${targetId}` },
        () => {
          void queryClient.invalidateQueries({ queryKey: key });
          void queryClient.invalidateQueries({ queryKey: ['collaborators', kind, targetId] });
        },
      )
      .subscribe();
    return () => void supabase.removeChannel(channel);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` is derived from kind/targetId/user.id, already deps
  }, [enabled, kind, targetId, queryClient]);

  if (isOwner) return { role: 'owner' as const, canEdit: true, isLoading: false };
  const role = query.data ?? null;
  return { role, canEdit: role === 'editor', isLoading: enabled && query.isLoading };
}
