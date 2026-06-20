import { supabase } from '@/lib/supabase';
import type { Invitation, InvitationRole, ProjectRole } from '@/types/database';

/**
 * Thin Supabase data layer for collaboration (members + invitations). Every call
 * is governed by Row Level Security (plan.md §6): members are visible to fellow
 * members; only the owner may invite, change roles, or remove people. These
 * functions never filter by user themselves. The TanStack hooks in useMembers.ts
 * wrap them with caching + optimistic updates.
 */

/** A project member joined with the profile fields we display. */
export interface MemberWithProfile {
  userId: string;
  role: ProjectRole;
  createdAt: string;
  displayName: string | null;
  avatarUrl: string | null;
}

/**
 * Members of a project with their display name + avatar. Two queries rather than
 * a PostgREST embed: project_members.user_id points at auth.users (not profiles),
 * so there's no FK to embed across. Co-member profiles are readable thanks to the
 * Phase 8 "select co-members" policy.
 */
export async function fetchMembers(projectId: string): Promise<MemberWithProfile[]> {
  const { data: members, error } = await supabase
    .from('project_members')
    .select('user_id, role, created_at')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true });
  if (error) throw error;

  const ids = members.map((member) => member.user_id);
  const profilesById = new Map<string, { display_name: string | null; avatar_url: string | null }>();
  if (ids.length > 0) {
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, display_name, avatar_url')
      .in('id', ids);
    if (profilesError) throw profilesError;
    for (const profile of profiles) {
      profilesById.set(profile.id, {
        display_name: profile.display_name,
        avatar_url: profile.avatar_url,
      });
    }
  }

  return members.map((member) => ({
    userId: member.user_id,
    role: member.role,
    createdAt: member.created_at,
    displayName: profilesById.get(member.user_id)?.display_name ?? null,
    avatarUrl: profilesById.get(member.user_id)?.avatar_url ?? null,
  }));
}

/** Pending (un-redeemed) invitations for a project. */
export async function fetchInvitations(projectId: string): Promise<Invitation[]> {
  const { data, error } = await supabase
    .from('invitations')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data;
}

export interface InviteInputApi {
  projectId: string;
  /** Already normalised to lowercase by the schema. */
  email: string;
  role: InvitationRole;
  invitedBy: string;
}

/**
 * Invite an email (owner only — enforced by RLS). Re-inviting the same address
 * just updates the pending role: the email is stored normalised, so a plain
 * equality lookup matches the case-insensitive unique index.
 */
export async function inviteMember(input: InviteInputApi): Promise<Invitation> {
  const { data: existing, error: findError } = await supabase
    .from('invitations')
    .select('id')
    .eq('project_id', input.projectId)
    .eq('email', input.email)
    .maybeSingle();
  if (findError) throw findError;

  if (existing) {
    const { data, error } = await supabase
      .from('invitations')
      .update({ role: input.role })
      .eq('id', existing.id)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  }

  const { data, error } = await supabase
    .from('invitations')
    .insert({
      project_id: input.projectId,
      email: input.email,
      role: input.role,
      invited_by: input.invitedBy,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

/** Change a member's role (owner only — enforced by RLS + owner-row trigger). */
export async function updateMemberRole(
  projectId: string,
  userId: string,
  role: InvitationRole,
): Promise<void> {
  const { error } = await supabase
    .from('project_members')
    .update({ role })
    .eq('project_id', projectId)
    .eq('user_id', userId);
  if (error) throw error;
}

/** Remove a member from a project (owner only; the owner row is trigger-protected). */
export async function removeMember(projectId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('project_members')
    .delete()
    .eq('project_id', projectId)
    .eq('user_id', userId);
  if (error) throw error;
}

/** Revoke a pending invitation (owner only — enforced by RLS). */
export async function cancelInvitation(id: string): Promise<void> {
  const { error } = await supabase.from('invitations').delete().eq('id', id);
  if (error) throw error;
}

/** Redeem the current user's pending invitations into memberships (RPC). */
export async function redeemMyInvitations(): Promise<number> {
  const { data, error } = await supabase.rpc('redeem_my_invitations');
  if (error) throw error;
  return data ?? 0;
}
