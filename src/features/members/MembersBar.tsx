import { useMemo, useState } from 'react';
import { Users } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Avatar } from '@/components/Avatar';
import { Modal } from '@/components/Modal';
import { GradientButton } from '@/components/buttons/GradientButton';
import type { AccentName } from '@/lib/accents';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/features/auth/useProfile';
import { resolveAvatarUrl, resolveDisplayName } from '@/features/auth/identity';
import { useMembers } from './useMembers';
import { usePresence, type PresenceUser } from './usePresence';
import { MembersPanel } from './MembersPanel';

interface MembersBarProps {
  projectId: string;
  accent: AccentName;
  isOwner: boolean;
}

const MAX_AVATARS = 4;

/**
 * The project header's collaboration cluster: a live avatar stack (members
 * currently viewing get a green ring + count, via Realtime Presence) and a button
 * that opens the full members panel. The current user joins presence here, so
 * simply rendering this bar marks them as "viewing".
 */
export function MembersBar({ projectId, accent, isOwner }: MembersBarProps) {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const { data } = useMembers(projectId);
  const [open, setOpen] = useState(false);

  const me: PresenceUser | null = user
    ? {
        userId: user.id,
        name: resolveDisplayName(profile, user),
        avatarUrl: resolveAvatarUrl(profile, user),
      }
    : null;
  const present = usePresence(projectId, me);
  const onlineIds = useMemo(() => new Set(present.map((person) => person.userId)), [present]);

  const members = useMemo(() => data?.members ?? [], [data?.members]);
  // Surface live collaborators first so they're always visible in the stack.
  const ordered = useMemo(
    () =>
      [...members].sort(
        (a, b) => Number(onlineIds.has(b.userId)) - Number(onlineIds.has(a.userId)),
      ),
    [members, onlineIds],
  );
  const shown = ordered.slice(0, MAX_AVATARS);
  const overflow = ordered.length - shown.length;
  const viewingCount = present.length;

  return (
    <>
      <div className="flex items-center gap-2.5">
        {members.length > 0 && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="View members"
            className="flex items-center -space-x-2 rounded-full p-0.5 transition-transform hover:scale-[1.03]"
          >
            {shown.map((member) => {
              const name = member.displayName?.trim() || 'Teammate';
              const online = onlineIds.has(member.userId);
              return (
                <span
                  key={member.userId}
                  className={cn(
                    'rounded-full ring-2',
                    online ? 'ring-success' : 'ring-[rgb(var(--bg))]',
                  )}
                  title={online ? `${name} · viewing` : name}
                >
                  <Avatar name={name} src={member.avatarUrl} size={30} />
                </span>
              );
            })}
            {overflow > 0 && (
              <span className="grid h-[30px] min-w-[30px] place-items-center rounded-full bg-[var(--glass-fill-strong)] px-1.5 text-xs font-semibold text-fg-muted ring-2 ring-[rgb(var(--bg))]">
                +{overflow}
              </span>
            )}
          </button>
        )}

        {viewingCount > 1 && (
          <span className="hidden items-center gap-1.5 text-xs font-medium text-fg-muted sm:inline-flex">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success/70" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
            </span>
            {viewingCount} viewing
          </span>
        )}

        <GradientButton
          variant="secondary"
          size="sm"
          leftIcon={<Users size={15} />}
          onClick={() => setOpen(true)}
        >
          {isOwner ? 'Share' : 'Members'}
        </GradientButton>
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        accent={accent}
        title="Members"
        description="Invite people, set roles, and see who's collaborating."
      >
        <MembersPanel
          projectId={projectId}
          isOwner={isOwner}
          currentUserId={user?.id}
          onlineUserIds={onlineIds}
        />
      </Modal>
    </>
  );
}
