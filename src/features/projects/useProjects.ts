import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import type { Project } from '@/types/database';
import {
  fetchProject,
  fetchProjects,
  insertProject,
  patchProject,
  removeProject,
} from './api';
import type { ProjectFormInput } from './schemas';

/** Cache key for a user's project list. Scoped to the user so it clears on
 *  sign-out / account switch. */
const projectsKey = (userId: string | undefined): QueryKey => ['projects', userId];

/** Empty description should be stored as NULL, not an empty string. */
const normalizeDescription = (value: string): string | null => value.trim() || null;

/** The current user's projects (RLS returns only those they belong to). */
export function useProjects() {
  const { user } = useAuth();
  return useQuery({
    queryKey: projectsKey(user?.id),
    enabled: Boolean(user?.id),
    queryFn: fetchProjects,
  });
}

/** A single project for the project route. */
export function useProject(projectId: string | undefined) {
  return useQuery({
    queryKey: ['project', projectId],
    enabled: Boolean(projectId),
    queryFn: () => fetchProject(projectId as string),
  });
}

interface MutationContext {
  previous?: Project[];
}

/** Create a project, optimistically prepending it to the list. */
export function useCreateProject() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const key = projectsKey(user?.id);

  return useMutation<Project, Error, ProjectFormInput, MutationContext & { tempId: string }>({
    mutationFn: (input) => {
      if (!user) throw new Error('You must be signed in.');
      return insertProject({
        ownerId: user.id,
        name: input.name,
        description: normalizeDescription(input.description),
        accent: input.accent,
      });
    },
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Project[]>(key);
      const tempId = crypto.randomUUID();
      const optimistic: Project = {
        id: tempId,
        owner_id: user?.id ?? '',
        name: input.name.trim(),
        description: normalizeDescription(input.description),
        accent: input.accent,
        created_at: new Date().toISOString(),
      };
      queryClient.setQueryData<Project[]>(key, (old) => [optimistic, ...(old ?? [])]);
      return { previous, tempId };
    },
    onError: (_error, _input, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },
    onSuccess: (created, _input, context) => {
      // Swap the temporary row for the server's (real id, server timestamp).
      queryClient.setQueryData<Project[]>(key, (old) =>
        (old ?? []).map((project) => (project.id === context.tempId ? created : project)),
      );
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: key });
    },
  });
}

export interface UpdateProjectVariables extends ProjectFormInput {
  id: string;
}

/** Update a project, optimistically patching it in the list + detail caches. */
export function useUpdateProject() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const key = projectsKey(user?.id);

  return useMutation<Project, Error, UpdateProjectVariables, MutationContext>({
    mutationFn: ({ id, ...input }) =>
      patchProject(id, {
        name: input.name,
        description: normalizeDescription(input.description),
        accent: input.accent,
      }),
    onMutate: async ({ id, ...input }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Project[]>(key);
      const patch = {
        name: input.name.trim(),
        description: normalizeDescription(input.description),
        accent: input.accent,
      };
      queryClient.setQueryData<Project[]>(key, (old) =>
        (old ?? []).map((project) => (project.id === id ? { ...project, ...patch } : project)),
      );
      queryClient.setQueryData<Project | null>(['project', id], (old) =>
        old ? { ...old, ...patch } : old,
      );
      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },
    onSuccess: (updated) => {
      queryClient.setQueryData<Project[]>(key, (old) =>
        (old ?? []).map((project) => (project.id === updated.id ? updated : project)),
      );
      queryClient.setQueryData(['project', updated.id], updated);
    },
    onSettled: (_data, _error, { id }) => {
      void queryClient.invalidateQueries({ queryKey: key });
      void queryClient.invalidateQueries({ queryKey: ['project', id] });
    },
  });
}

/** Delete a project, optimistically removing it from the list. */
export function useDeleteProject() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const key = projectsKey(user?.id);

  return useMutation<void, Error, string, MutationContext>({
    mutationFn: (id) => removeProject(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Project[]>(key);
      queryClient.setQueryData<Project[]>(key, (old) =>
        (old ?? []).filter((project) => project.id !== id),
      );
      return { previous };
    },
    onError: (_error, _id, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: key });
    },
  });
}
