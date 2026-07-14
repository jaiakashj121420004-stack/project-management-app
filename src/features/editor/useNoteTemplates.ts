import { useEffect } from 'react';
import { useQuery, type QueryKey } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useOptimisticMutation } from '@/lib/useOptimisticMutation';
import type { NoteTemplateRow } from '@/types/database';
import {
  fetchNoteTemplates,
  insertNoteTemplate,
  removeNoteTemplate,
  renameNoteTemplate,
} from './templates.api';
import { setCustomTemplates } from './customTemplateStore';
import { templateDocToBlocks, templateSubtitle } from './templateDoc';

/**
 * Custom note templates live in one owner-scoped cache, `['note-templates',
 * userId]` → NoteTemplateRow[], newest-edited first. Mutations are optimistic
 * over the shared useOptimisticMutation primitive (the same pattern as notes /
 * folders), so the manager + slash menu update instantly and roll back on error.
 */
const templatesKey = (userId: string | undefined): QueryKey => ['note-templates', userId];

export function useNoteTemplates() {
  const { user } = useAuth();
  return useQuery({
    queryKey: templatesKey(user?.id),
    enabled: Boolean(user?.id),
    queryFn: fetchNoteTemplates,
  });
}

export function useCreateNoteTemplate() {
  const { user } = useAuth();
  return useOptimisticMutation<
    NoteTemplateRow,
    { title: string; subtitle: string | null; icon: string | null; content_json: Record<string, unknown>; tempId: string },
    NoteTemplateRow[]
  >({
    queryKey: templatesKey(user?.id),
    mutationFn: ({ title, subtitle, icon, content_json }) =>
      insertNoteTemplate({ title, subtitle, icon, content_json }),
    patch: (old, { title, subtitle, icon, content_json, tempId }) => {
      const now = new Date().toISOString();
      return [
        {
          id: tempId,
          owner_id: user?.id ?? '',
          title: title.trim(),
          subtitle,
          icon,
          content_json,
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

export function useRenameNoteTemplate() {
  const { user } = useAuth();
  return useOptimisticMutation<NoteTemplateRow, { id: string; title: string }, NoteTemplateRow[]>({
    queryKey: templatesKey(user?.id),
    mutationFn: ({ id, title }) => renameNoteTemplate(id, title),
    patch: (old, { id, title }) =>
      (old ?? []).map((template) =>
        template.id === id ? { ...template, title: title.trim() } : template,
      ),
    reconcile: (old, updated) =>
      old.map((template) => (template.id === updated.id ? updated : template)),
  });
}

export function useDeleteNoteTemplate() {
  const { user } = useAuth();
  return useOptimisticMutation<void, { id: string }, NoteTemplateRow[]>({
    queryKey: templatesKey(user?.id),
    mutationFn: ({ id }) => removeNoteTemplate(id),
    patch: (old, { id }) => (old ?? []).filter((template) => template.id !== id),
  });
}

/**
 * Mount once inside an open note editor: keeps the module-level custom-template
 * snapshot (read by the slash menu) in sync with the query cache. Extracting the
 * blocks + subtitle here means the slash `items` callback stays a cheap read.
 */
export function useSyncCustomTemplates(): void {
  const { data } = useNoteTemplates();
  useEffect(() => {
    setCustomTemplates(
      (data ?? []).map((template) => ({
        id: template.id,
        title: template.title,
        subtitle: template.subtitle?.trim() || templateSubtitle(template.content_json),
        blocks: templateDocToBlocks(template.content_json),
      })),
    );
  }, [data]);
}
