import { useEffect } from 'react';
import { useQueryClient, type QueryKey } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

/**
 * Live collaboration: subscribe to Postgres changes for the ACTIVE project and
 * reconcile them into the TanStack caches the board, card modal, and notes read
 * from. Rather than surgically patch each cache from an event payload — fragile,
 * since DELETE events carry only the row's identity and child tables
 * (checklist_items, card_labels) carry no project_id — we DEBOUNCE an
 * invalidation of the affected, project-scoped query. The refetch is the
 * authoritative, RLS-filtered snapshot, so there are no duplicates, no flicker
 * (TanStack swaps only when data actually changes), and the merge is naturally
 * conflict-tolerant. Our own optimistic writes are unaffected: an extra
 * background refetch of data we just wrote is a no-op.
 *
 * Cross-project safety: Realtime applies the same RLS as a read, so a member
 * only receives events for rows they may see. Every invalidation is keyed to
 * THIS projectId and every refetch is project-scoped, so nothing leaks between
 * projects even for the child tables we can't filter server-side.
 */

const DEBOUNCE_MS = 250;

export function useProjectRealtime(projectId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!projectId) return;

    const timers = new Map<string, ReturnType<typeof setTimeout>>();
    const invalidate = (key: QueryKey) => {
      const id = JSON.stringify(key);
      const pending = timers.get(id);
      if (pending) clearTimeout(pending);
      timers.set(
        id,
        setTimeout(() => {
          timers.delete(id);
          void queryClient.invalidateQueries({ queryKey: key });
        }, DEBOUNCE_MS),
      );
    };

    const refreshBoard = () => invalidate(['board', projectId]);
    const refreshExtras = () => invalidate(['card-extras', projectId]);
    const refreshNotes = () => invalidate(['notes', projectId]);
    const refreshMembers = () => {
      invalidate(['members', projectId]);
      // A membership change might mean we were added/removed/re-roled.
      invalidate(['projects']);
      invalidate(['project', projectId]);
    };

    const projectFilter = `project_id=eq.${projectId}`;
    const channel = supabase
      .channel(`project-changes:${projectId}`)
      // Tables carrying project_id are filtered server-side (REPLICA IDENTITY
      // FULL makes the filter match on deletes too).
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'columns', filter: projectFilter },
        refreshBoard,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cards', filter: projectFilter },
        refreshBoard,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'labels', filter: projectFilter },
        refreshExtras,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notes', filter: projectFilter },
        refreshNotes,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'project_members', filter: projectFilter },
        refreshMembers,
      )
      // Card children have no project_id to filter on; RLS still scopes which
      // events arrive, and the refetch is project-scoped, so refreshing this
      // project's extras on any of them is safe (at worst a redundant refetch).
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'checklist_items' },
        refreshExtras,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'card_labels' },
        refreshExtras,
      )
      .subscribe();

    return () => {
      for (const timer of timers.values()) clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [projectId, queryClient]);
}
