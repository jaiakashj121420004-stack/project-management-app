import { supabase } from '@/lib/supabase';
import type { AccentName } from '@/lib/accents';
import type { LabelColor } from '@/lib/labelColors';

/**
 * Data layer for public read-only project share links. Create/revoke are
 * plain RLS-gated table writes (owner-only, see
 * 20260816150000_project_share_links.sql) — no Edge Function needed for those,
 * unlike the calendar feed token, because there is no cross-user column to
 * protect here. The PUBLIC read side (serving board data by token, no
 * session) goes through the `project-share` Edge Function instead — see
 * `fetchSharedProject` below.
 */

export interface ProjectShareLink {
  token: string;
  createdAt: string;
}

/** The project's current active share link, or null if none is turned on.
 *  RLS restricts this to the project owner — nobody else can ever read it. */
export async function fetchProjectShareLink(projectId: string): Promise<ProjectShareLink | null> {
  const { data, error } = await supabase
    .from('project_share_links')
    .select('token, created_at')
    .eq('project_id', projectId)
    .is('revoked_at', null)
    .maybeSingle();
  if (error) throw error;
  return data ? { token: data.token, createdAt: data.created_at } : null;
}

/** Turns the link on. Idempotent: if an active link already exists (e.g. a
 *  second tab raced this one), the DB's partial unique index rejects the
 *  duplicate insert and we just re-fetch the existing one instead of erroring. */
export async function createProjectShareLink(projectId: string): Promise<ProjectShareLink> {
  const { data, error } = await supabase
    .from('project_share_links')
    .insert({ project_id: projectId })
    .select('token, created_at')
    .single();
  if (error) {
    // Postgres unique_violation — another active link already won the race.
    if (error.code === '23505') {
      const existing = await fetchProjectShareLink(projectId);
      if (existing) return existing;
    }
    throw error;
  }
  return { token: data.token, createdAt: data.created_at };
}

/** Turns the link off. A previously-shared URL immediately 404s. */
export async function revokeProjectShareLink(projectId: string): Promise<void> {
  const { error } = await supabase
    .from('project_share_links')
    .update({ revoked_at: new Date().toISOString() })
    .eq('project_id', projectId)
    .is('revoked_at', null);
  if (error) throw error;
}

/** The full HTTPS URL to give people — our own app's public route, not the
 *  Edge Function URL directly (mirrors feedUrlForToken's shape). */
export function shareUrlForToken(token: string): string {
  return `${window.location.origin}/share/${token}`;
}

// --- Public read side (no session) -------------------------------------------

export interface SharedLabel {
  name: string;
  color: LabelColor;
}

export interface SharedCard {
  id: string;
  columnId: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  dueAt: string | null;
  position: number;
  labels: SharedLabel[];
}

export interface SharedColumn {
  id: string;
  name: string;
  position: number;
}

export interface SharedProject {
  project: { name: string; description: string | null; accent: AccentName };
  columns: SharedColumn[];
  cards: SharedCard[];
}

/** A 404 from the share endpoint (invalid/unknown/revoked token) — distinct
 *  from a network/server error so the page can show "this link isn't valid"
 *  rather than a generic error state. */
export class SharedProjectNotFoundError extends Error {
  constructor() {
    super('This share link is invalid or has been revoked.');
    this.name = 'SharedProjectNotFoundError';
  }
}

/** Fetches the read-only board snapshot for a share token. Unauthenticated —
 *  no Supabase session is sent or required, matching the public route's own
 *  `--no-verify-jwt` deployment (see the function's file header). */
export async function fetchSharedProject(token: string): Promise<SharedProject> {
  const base = import.meta.env.VITE_SUPABASE_URL;
  const res = await fetch(`${base}/functions/v1/project-share?token=${encodeURIComponent(token)}`);
  if (res.status === 404) throw new SharedProjectNotFoundError();
  if (!res.ok) throw new Error(`Could not load this board (${res.status}).`);
  return (await res.json()) as SharedProject;
}
