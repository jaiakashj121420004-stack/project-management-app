import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, Check, LogOut, Mail, Sparkles, UserMinus, X } from 'lucide-react';
import { Avatar } from '@/components/Avatar';
import { Field } from '@/components/forms/Field';
import { GradientButton } from '@/components/buttons/GradientButton';
import { Spinner } from '@/components/feedback/Spinner';
import type { Invitation, InvitationRole } from '@/types/database';
import type { MemberWithProfile } from './api';
import { useCancelInvitation, useInviteMember, useMembers, useRemoveMember, useUpdateMemberRole } from './useMembers';
import { RoleBadge, RoleSelect, ROLE_LABEL } from './RoleControl';
import { useLeaveProject } from './useInvitations';
import { useProfile } from '@/features/auth/useProfile';
import { FREE_MEMBER_LIMIT, isAtMemberLimit } from '@/lib/plans';
import { inviteSchema, fieldErrorsOf } from './schemas';

interface MembersPanelProps {
  projectId: string;
  isOwner: boolean;
  currentUserId: string | undefined;
  /** User ids currently viewing the board (Presence) — drives the live ring. */
  onlineUserIds: Set<string>;
}

/** The members panel body (rendered inside the shared Modal): the roster with
 *  roles, pending invitations, and — for the owner — an invite form. */
export function MembersPanel({ projectId, isOwner, currentUserId, onlineUserIds }: MembersPanelProps) {
  const { data, isLoading, isError } = useMembers(projectId);
  const { data: profile } = useProfile();
  const navigate = useNavigate();
  const leaveProject = useLeaveProject();

  if (isLoading) {
    return (
      <div className="grid place-items-center py-12">
        <Spinner size={28} />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <p className="py-8 text-center text-sm text-fg-muted">
        Couldn&apos;t load members. Check your connection and try again.
      </p>
    );
  }

  const atMemberLimit = isAtMemberLimit(profile?.plan ?? 'free', data.members.length);

  return (
    <div className="-mr-2 flex max-h-[70vh] flex-col gap-6 overflow-y-auto pr-2">
      <section className="flex flex-col gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-fg-muted">
          Members · {data.members.length}
        </h3>
        <ul className="flex flex-col gap-1.5">
          {data.members.map((member) => (
            <MemberRow
              key={member.userId}
              projectId={projectId}
              member={member}
              isOwner={isOwner}
              isSelf={member.userId === currentUserId}
              online={onlineUserIds.has(member.userId)}
            />
          ))}
        </ul>
      </section>

      {data.invitations.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-fg-muted">
            Pending invitations · {data.invitations.length}
          </h3>
          <ul className="flex flex-col gap-1.5">
            {data.invitations.map((invitation) => (
              <InvitationRow
                key={invitation.id}
                projectId={projectId}
                invitation={invitation}
                canManage={isOwner}
              />
            ))}
          </ul>
        </section>
      )}

      {isOwner ? (
        atMemberLimit ? (
          <MemberLimitNotice />
        ) : (
          <InviteForm projectId={projectId} />
        )
      ) : (
        <div className="flex flex-col gap-3 border-t border-[var(--glass-border)] pt-5">
          <p className="text-sm text-fg-muted">
            Only the project owner can invite people or change roles.
          </p>
          {currentUserId && (
            <button
              type="button"
              onClick={() =>
                leaveProject.mutate(
                  { projectId, userId: currentUserId },
                  { onSuccess: () => void navigate('/boards') },
                )
              }
              disabled={leaveProject.isPending}
              className="inline-flex items-center justify-center gap-2 self-start rounded-2xl border border-danger/30 bg-danger/10 px-4 py-2.5 text-sm font-medium text-danger transition-colors hover:bg-danger/20 disabled:opacity-50"
            >
              <LogOut size={16} aria-hidden />
              Leave project
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function MemberRow({
  projectId,
  member,
  isOwner,
  isSelf,
  online,
}: {
  projectId: string;
  member: MemberWithProfile;
  isOwner: boolean;
  isSelf: boolean;
  online: boolean;
}) {
  const updateRole = useUpdateMemberRole(projectId);
  const removeMember = useRemoveMember(projectId);
  const name = member.displayName?.trim() || 'Teammate';
  const isProjectOwner = member.role === 'owner';
  // The owner may change/remove everyone except the project owner row.
  const canManageThis = isOwner && !isProjectOwner;

  return (
    <li className="flex items-center gap-3 rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-fill)] px-3 py-2">
      <span className="relative shrink-0">
        <Avatar name={name} src={member.avatarUrl} size={36} />
        {online && (
          <span
            className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[rgb(var(--bg))] bg-success"
            title="Viewing now"
            aria-label="Viewing now"
          />
        )}
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-fg">
          {name}
          {isSelf && <span className="ml-1.5 text-xs font-normal text-fg-subtle">(You)</span>}
        </p>
        {online && <p className="text-xs text-success">Viewing now</p>}
      </div>

      {canManageThis ? (
        <RoleSelect
          value={member.role as InvitationRole}
          onChange={(role) => updateRole.mutate({ userId: member.userId, role })}
          disabled={updateRole.isPending}
        />
      ) : (
        <RoleBadge role={member.role} />
      )}

      {canManageThis && (
        <button
          type="button"
          aria-label={`Remove ${name}`}
          onClick={() => removeMember.mutate({ userId: member.userId })}
          disabled={removeMember.isPending}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-xl text-fg-subtle transition-colors hover:bg-danger/10 hover:text-danger disabled:opacity-50"
        >
          <UserMinus size={16} />
        </button>
      )}
    </li>
  );
}

function InvitationRow({
  projectId,
  invitation,
  canManage,
}: {
  projectId: string;
  invitation: Invitation;
  canManage: boolean;
}) {
  const cancel = useCancelInvitation(projectId);

  return (
    <li className="flex items-center gap-3 rounded-2xl border border-dashed border-[var(--glass-border)] px-3 py-2">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--glass-fill)] text-fg-subtle">
        <Mail size={16} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-fg">{invitation.email}</p>
        <p className="text-xs text-fg-subtle">Invited as {ROLE_LABEL[invitation.role]} · pending</p>
      </div>
      {canManage && (
        <button
          type="button"
          aria-label={`Cancel invitation to ${invitation.email}`}
          onClick={() => cancel.mutate({ id: invitation.id })}
          disabled={cancel.isPending}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-xl text-fg-subtle transition-colors hover:bg-danger/10 hover:text-danger disabled:opacity-50"
        >
          <X size={16} />
        </button>
      )}
    </li>
  );
}

function MemberLimitNotice() {
  return (
    <div className="flex flex-col gap-3 border-t border-[var(--glass-border)] pt-5">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-fg-muted">Invite someone</h3>
      <div className="flex items-start gap-3 rounded-2xl border border-[var(--accent-from)]/30 bg-[var(--glass-fill)] px-3.5 py-3">
        <Sparkles size={18} className="mt-0.5 shrink-0 text-[var(--accent-from)]" aria-hidden />
        <div className="text-sm">
          <p className="font-medium text-fg">
            You&apos;ve reached {FREE_MEMBER_LIMIT} members on the Free plan.
          </p>
          <p className="mt-0.5 text-fg-muted">
            <Link
              to="/billing"
              className="font-semibold text-[var(--accent-from)] hover:underline"
            >
              Upgrade to Pro
            </Link>{' '}
            for unlimited collaborators per board.
          </p>
        </div>
      </div>
    </div>
  );
}

function InviteForm({ projectId }: { projectId: string }) {
  const invite = useInviteMember(projectId);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<InvitationRole>('editor');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    setSentTo(null);
    const parsed = inviteSchema.safeParse({ email, role });
    if (!parsed.success) {
      setErrors(fieldErrorsOf(parsed.error));
      return;
    }
    setErrors({});
    invite.mutate(
      { email: parsed.data.email, role: parsed.data.role },
      {
        onSuccess: () => {
          setSentTo(parsed.data.email);
          setEmail('');
        },
        onError: () => setFormError('Could not send that invitation. Please try again.'),
      },
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="flex flex-col gap-3 border-t border-[var(--glass-border)] pt-5"
    >
      <h3 className="text-xs font-semibold uppercase tracking-wide text-fg-muted">Invite someone</h3>

      {sentTo && (
        <div className="flex items-center gap-2 rounded-2xl border border-success/30 bg-success/10 px-3.5 py-2.5 text-sm text-success">
          <Check size={16} className="shrink-0" />
          <span>
            Invited <span className="font-semibold">{sentTo}</span>. They&apos;ll join when they sign
            in.
          </span>
        </div>
      )}
      {formError && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-2xl border border-danger/30 bg-danger/10 px-3.5 py-2.5 text-sm text-danger"
        >
          <AlertCircle size={16} className="shrink-0" />
          <span>{formError}</span>
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="flex-1">
          <Field
            type="email"
            placeholder="teammate@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            error={errors.email}
            leftIcon={<Mail size={16} />}
            aria-label="Invitee email"
          />
        </div>
        <RoleSelect value={role} onChange={setRole} size="md" openUp />
        <GradientButton type="submit" isLoading={invite.isPending} className="sm:h-11">
          Invite
        </GradientButton>
      </div>
      <p className="text-xs text-fg-subtle">
        Editors can change the board and notes. Viewers have read-only access.
      </p>
    </form>
  );
}
