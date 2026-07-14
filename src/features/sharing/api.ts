import { supabase } from '@/lib/supabase';

/**
 * Data layer for sharing a personal canvas or a standalone note with other
 * registered users. Adding a collaborator goes through a SECURITY DEFINER RPC
 * (share_canvas / share_note) that resolves the email and upserts the membership
 * (owner-gated in the DB). Reads use the *_collaborators RPCs so each row carries
 * the profile + email even across RLS boundaries. Role changes / removals are
 * plain member-table writes (owner-gated by RLS).
 */

export type ShareKind = 'canvas' | 'note';
export type ShareRole = 'editor' | 'viewer';

export interface Collaborator {
  userId: string;
  role: ShareRole;
  createdAt: string;
  displayName: string | null;
  avatarUrl: string | null;
  email: string | null;
}

export async function fetchCollaborators(kind: ShareKind, targetId: string): Promise<Collaborator[]> {
  const { data, error } =
    kind === 'canvas'
      ? await supabase.rpc('canvas_collaborators', { p_canvas_id: targetId })
      : await supabase.rpc('note_collaborators', { p_note_id: targetId });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    userId: row.user_id,
    role: (row.role as ShareRole) ?? 'viewer',
    createdAt: row.created_at,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    email: row.email,
  }));
}

export async function shareTarget(
  kind: ShareKind,
  targetId: string,
  email: string,
  role: ShareRole,
): Promise<void> {
  const { error } =
    kind === 'canvas'
      ? await supabase.rpc('share_canvas', { p_canvas_id: targetId, p_email: email, p_role: role })
      : await supabase.rpc('share_note', { p_note_id: targetId, p_email: email, p_role: role });
  if (error) throw error;
}

export async function setCollaboratorRole(
  kind: ShareKind,
  targetId: string,
  userId: string,
  role: ShareRole,
): Promise<void> {
  const query =
    kind === 'canvas'
      ? supabase.from('canvas_members').update({ role }).eq('canvas_id', targetId).eq('user_id', userId)
      : supabase.from('note_members').update({ role }).eq('note_id', targetId).eq('user_id', userId);
  const { error } = await query;
  if (error) throw error;
}

export async function removeCollaborator(
  kind: ShareKind,
  targetId: string,
  userId: string,
): Promise<void> {
  const query =
    kind === 'canvas'
      ? supabase.from('canvas_members').delete().eq('canvas_id', targetId).eq('user_id', userId)
      : supabase.from('note_members').delete().eq('note_id', targetId).eq('user_id', userId);
  const { error } = await query;
  if (error) throw error;
}
