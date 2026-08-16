import { supabase } from '@/lib/supabase';

export interface ContentSearchResult {
  kind: 'card' | 'note';
  id: string;
  projectId: string | null;
  projectName: string | null;
  title: string;
  snippet: string;
  rank: number;
}

/**
 * Query-as-you-type full-text search over the caller's own cards + notes, via
 * the `search_workspace` RPC (supabase/migrations/20260817120000_content_search.sql).
 * That RPC is a plain SECURITY INVOKER function, so it can never return a row
 * the caller's RLS wouldn't already let them read — this layer just shapes the
 * response for the frontend. Short-circuits on a too-short query rather than
 * round-tripping for one or two characters.
 */
export async function searchWorkspace(
  query: string,
  limitCount: number,
): Promise<ContentSearchResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const { data, error } = await supabase.rpc('search_workspace', {
    p_query: trimmed,
    p_limit: limitCount,
  });
  if (error) throw error;

  return (data ?? []).map((row) => ({
    kind: row.kind,
    id: row.id,
    projectId: row.project_id,
    projectName: row.project_name,
    title: row.title,
    snippet: row.snippet,
    rank: row.rank,
  }));
}
