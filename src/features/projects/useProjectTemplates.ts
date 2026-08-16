import { useQuery, type QueryKey } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useOptimisticMutation } from '@/lib/useOptimisticMutation';
import type { ProjectTemplateRow } from '@/types/database';
import {
  fetchProjectTemplates,
  insertProjectTemplate,
  removeProjectTemplate,
  updateProjectTemplateMeta,
} from './templates.api';
import type { ProjectTemplatePayload } from './templateSchemas';

/**
 * A user's own project templates live in one owner-scoped cache,
 * `['project-templates', userId]` → ProjectTemplateRow[], newest-edited
 * first. Mutations are optimistic over the shared useOptimisticMutation
 * primitive — the same pattern as useNoteTemplates.ts — so the New Project
 * picker's "My templates" grid updates instantly and rolls back on error.
 */
const templatesKey = (userId: string | undefined): QueryKey => ['project-templates', userId];

export function useProjectTemplates() {
  const { user } = useAuth();
  return useQuery({
    queryKey: templatesKey(user?.id),
    enabled: Boolean(user?.id),
    queryFn: fetchProjectTemplates,
  });
}

export function useCreateProjectTemplate() {
  const { user } = useAuth();
  return useOptimisticMutation<
    ProjectTemplateRow,
    {
      name: string;
      description: string | null;
      icon: string | null;
      payload: ProjectTemplatePayload;
      tempId: string;
    },
    ProjectTemplateRow[]
  >({
    queryKey: templatesKey(user?.id),
    mutationFn: ({ name, description, icon, payload }) =>
      insertProjectTemplate({ name, description, icon, payload }),
    patch: (old, { name, description, icon, payload, tempId }) => {
      const now = new Date().toISOString();
      return [
        {
          id: tempId,
          owner_id: user?.id ?? '',
          source: 'user',
          name: name.trim(),
          description,
          icon,
          payload,
          created_at: now,
          updated_at: now,
        },
        ...(old ?? []),
      ];
    },
    reconcile: (old, created, { tempId }) =>
      old.map((template) => (template.id === tempId ? created : template)),
  });
}

export function useUpdateProjectTemplateMeta() {
  const { user } = useAuth();
  return useOptimisticMutation<
    ProjectTemplateRow,
    { id: string; name: string; description: string | null; icon: string | null },
    ProjectTemplateRow[]
  >({
    queryKey: templatesKey(user?.id),
    mutationFn: ({ id, name, description, icon }) =>
      updateProjectTemplateMeta(id, { name, description, icon }),
    patch: (old, { id, name, description, icon }) =>
      (old ?? []).map((template) =>
        template.id === id ? { ...template, name: name.trim(), description, icon } : template,
      ),
    reconcile: (old, updated) =>
      old.map((template) => (template.id === updated.id ? updated : template)),
  });
}

export function useDeleteProjectTemplate() {
  const { user } = useAuth();
  return useOptimisticMutation<void, { id: string }, ProjectTemplateRow[]>({
    queryKey: templatesKey(user?.id),
    mutationFn: ({ id }) => removeProjectTemplate(id),
    patch: (old, { id }) => (old ?? []).filter((template) => template.id !== id),
  });
}
