import { supabase } from '@/lib/supabase';
import type { CanvasNote } from '@/types/database';
import type { PageType } from '@/lib/canvasPages';
import type { CanvasScene } from './elements';

/**
 * Supabase data layer for the Pro Notes Canvas. Every call is governed by RLS
 * (20260622180000_canvas.sql): members read; only editors on a PRO board create
 * or edit. These functions never filter by user — the policies do. The hooks in
 * useCanvas.ts add caching + autosave. updated_at/updated_by are trigger-managed.
 */

/**
 * Lightweight list row — everything except the heavy `scene`/`doc_state` blobs,
 * so the per-project list stays cheap to load. The full document is fetched
 * per-canvas by fetchCanvas when an editor opens it.
 */
export type CanvasNoteSummary = Omit<CanvasNote, 'scene' | 'doc_state'>;

const SUMMARY_COLUMNS = 'id, project_id, title, page_type, updated_by, updated_at, created_at';

/** All canvases for a project, most-recently-edited first (RLS-scoped). */
export async function fetchCanvasList(projectId: string): Promise<CanvasNoteSummary[]> {
  const { data, error } = await supabase
    .from('canvas_notes')
    .select(SUMMARY_COLUMNS)
    .eq('project_id', projectId)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return data;
}

/** The full canvas (including its scene) for the editor. */
export async function fetchCanvas(id: string): Promise<CanvasNote> {
  const { data, error } = await supabase
    .from('canvas_notes')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

export async function insertCanvas(input: {
  projectId: string;
  title: string;
  pageType?: PageType;
}): Promise<CanvasNote> {
  const { data, error } = await supabase
    .from('canvas_notes')
    .insert({
      project_id: input.projectId,
      title: input.title,
      ...(input.pageType ? { page_type: input.pageType } : {}),
    })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

/** Patch a canvas's title, page type and/or scene. The trigger refreshes
 *  updated_at + updated_by. The scene is plain JSON, cast to the jsonb column. */
export async function patchCanvas(
  id: string,
  patch: { title?: string; page_type?: PageType; scene?: CanvasScene },
): Promise<CanvasNote> {
  const update: { title?: string; page_type?: PageType; scene?: Record<string, unknown> } = {
    ...(patch.title !== undefined ? { title: patch.title } : {}),
    ...(patch.page_type !== undefined ? { page_type: patch.page_type } : {}),
    ...(patch.scene !== undefined
      ? { scene: patch.scene as unknown as Record<string, unknown> }
      : {}),
  };
  const { data, error } = await supabase
    .from('canvas_notes')
    .update(update)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function removeCanvas(id: string): Promise<void> {
  const { error } = await supabase.from('canvas_notes').delete().eq('id', id);
  if (error) throw error;
}
