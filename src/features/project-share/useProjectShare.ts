import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createProjectShareLink,
  fetchProjectShareLink,
  fetchSharedProject,
  revokeProjectShareLink,
} from './api';

const key = (projectId: string) => ['project-share-link', projectId] as const;

/** The project's current active share link (owner-only — RLS), or null if the
 *  public read-only link is off. */
export function useProjectShareLink(projectId: string) {
  return useQuery({
    queryKey: key(projectId),
    queryFn: () => fetchProjectShareLink(projectId),
    enabled: Boolean(projectId),
    staleTime: 60 * 1000,
  });
}

export function useCreateProjectShareLink(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => createProjectShareLink(projectId),
    onSuccess: (link) => {
      queryClient.setQueryData(key(projectId), link);
    },
  });
}

export function useRevokeProjectShareLink(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => revokeProjectShareLink(projectId),
    onSuccess: () => {
      queryClient.setQueryData(key(projectId), null);
    },
  });
}

/** The public, unauthenticated read of a shared board by token — used by the
 *  `/share/:token` route. Retries are limited: a 404 (invalid/revoked token)
 *  is a stable result, not a transient failure worth retrying. */
export function useSharedProject(token: string | undefined) {
  return useQuery({
    queryKey: ['shared-project', token],
    queryFn: () => fetchSharedProject(token!),
    enabled: Boolean(token),
    retry: (failureCount, error) =>
      error instanceof Error && error.name === 'SharedProjectNotFoundError' ? false : failureCount < 2,
  });
}
