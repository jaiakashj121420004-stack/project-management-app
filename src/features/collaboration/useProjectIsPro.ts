import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

/**
 * Is the OWNER of this project on Pro? For a shared board the owner's plan is
 * what governs every Pro feature (RLS + project_is_pro), so the collaboration UI
 * gates on THIS rather than the viewer's own plan (useIsPro). A member of a
 * free-owner board correctly sees the upgrade prompt even if they're personally
 * Pro — matching what the database will actually allow.
 *
 * UX gate only — `project_is_pro()` in RLS is the real enforcement (plan.md §6).
 */
export function useProjectIsPro(projectId: string | undefined) {
  return useQuery({
    queryKey: ['project-is-pro', projectId],
    enabled: Boolean(projectId),
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<boolean> => {
      const { data, error } = await supabase.rpc('project_is_pro', {
        p_project_id: projectId as string,
      });
      if (error) throw error;
      return data ?? false;
    },
  });
}
