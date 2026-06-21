import { useNavigate } from 'react-router-dom';
import { Check, Mail, X } from 'lucide-react';
import { GlassPanel } from '@/components/glass/GlassPanel';
import { GradientButton } from '@/components/buttons/GradientButton';
import { Reveal } from '@/components/motion/Reveal';
import { RoleBadge } from './RoleControl';
import { useAcceptInvitation, useDeclineInvitation, useMyInvitations } from './useInvitations';

/**
 * Banner on the Projects dashboard listing invitations addressed to the current
 * user. Each can be Accepted (→ join + open the project) or Declined. Renders
 * nothing when there are none, so it's safe to always mount.
 */
export function PendingInvitations() {
  const { data: invitations } = useMyInvitations();
  const accept = useAcceptInvitation();
  const decline = useDeclineInvitation();
  const navigate = useNavigate();

  if (!invitations || invitations.length === 0) return null;

  const pending = accept.isPending || decline.isPending;

  return (
    <Reveal>
      <GlassPanel strong glow className="flex flex-col gap-3 p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-fg">
          <Mail size={16} className="text-[var(--accent-from)]" aria-hidden />
          Invitations ({invitations.length})
        </h2>
        <ul className="flex flex-col gap-2">
          {invitations.map((invitation) => (
            <li
              key={invitation.id}
              className="flex flex-wrap items-center gap-3 rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-fill)] px-3.5 py-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-fg">{invitation.projectName}</p>
                <p className="text-xs text-fg-subtle">You&apos;ve been invited to collaborate</p>
              </div>
              <RoleBadge role={invitation.role} />
              <div className="flex items-center gap-2">
                <GradientButton
                  size="sm"
                  leftIcon={<Check size={15} />}
                  isLoading={accept.isPending}
                  disabled={pending}
                  onClick={() =>
                    accept.mutate(invitation.id, {
                      onSuccess: (projectId) => void navigate(`/projects/${projectId}`),
                    })
                  }
                >
                  Accept
                </GradientButton>
                <button
                  type="button"
                  aria-label={`Decline invitation to ${invitation.projectName}`}
                  onClick={() => decline.mutate(invitation.id)}
                  disabled={pending}
                  className="grid h-9 w-9 place-items-center rounded-xl text-fg-subtle transition-colors hover:bg-danger/10 hover:text-danger disabled:opacity-50"
                >
                  <X size={16} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      </GlassPanel>
    </Reveal>
  );
}
