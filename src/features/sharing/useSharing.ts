import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchCollaborators,
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
