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

const SUMMARY_COLUMNS =
  'id, project_id, owner_id, title, page_type, updated_by, updated_at, created_at';

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

/**
 * Every canvas the signed-in user can access, newest-edited first — their
 * personal canvases (project_id null), canvases across all their projects, and
 * any shared with them directly. RLS does the scoping; we never filter by user
 * here. Backs the aggregated /canvas workspace; the hook labels each row
 * Personal vs its project name from the projects cache.
 */
export async function fetchAllCanvases(): Promise<CanvasNoteSummary[]> {
  const { data, error } = await supabase
    .from('canvas_notes')
    .select(SUMMARY_COLUMNS)
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

/** Create a canvas inside a project (shared via project membership). RLS
 *  requires a Pro board + edit rights. */
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

/** Create a PERSONAL canvas (no project). owner_id defaults to auth.uid()
 *  server-side; RLS requires the caller to be on Pro. */
export async function insertIndependentCanvas(input: {
  title: string;
  pageType?: PageType;
}): Promise<CanvasNote> {
  const { data, error } = await supabase
    .from('canvas_notes')
    .insert({
      project_id: null,
      title: input.title,
      ...(input.pageType ? { page_type: input.pageType } : {}),
    })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

/** Patch a canvas's title, page type, scene and/or Yjs doc_state. The trigger
 *  refreshes updated_at + updated_by. The scene is plain JSON, cast to the jsonb
 *  column; doc_state is a Postgres bytea hex literal (`\x…`) for the BYTEA column. */
export async function patchCanvas(
  id: string,
  patch: { title?: string; page_type?: PageType; scene?: CanvasScene; doc_state?: string },
): Promise<CanvasNote> {
  const update: {
    title?: string;
    page_type?: PageType;
    scene?: Record<string, unknown>;
    doc_state?: string;
  } = {
    ...(patch.title !== undefined ? { title: patch.title } : {}),
    ...(patch.page_type !== undefined ? { page_type: patch.page_type } : {}),
    ...(patch.scene !== undefined
      ? { scene: patch.scene as unknown as Record<string, unknown> }
      : {}),
    ...(patch.doc_state !== undefined ? { doc_state: patch.doc_state } : {}),
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
