import { useState, type FormEvent } from 'react';
import { Eye, Pencil, Trash2, UserPlus } from 'lucide-react';
import { Modal } from '@/components/Modal';
import { GradientButton } from '@/components/buttons/GradientButton';
import { SegmentedToggle } from '@/components/forms/SegmentedToggle';
import { Spinner } from '@/components/feedback/Spinner';
import { cn } from '@/lib/cn';
import { useSharing } from './useSharing';
import type { Collaborator, ShareKind, ShareRole } from './api';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface SharePanelProps {
  open: boolean;
  onClose: () => void;
  kind: ShareKind;
  targetId: string;
  /** Shown in the header, e.g. the canvas / note title. */
  title: string;
}

/**
 * Owner-facing sharing dialog for a personal canvas or standalone note: invite a
 * registered user by email as editor/viewer, change roles, and remove people.
 * Errors from the share RPC (unknown email, not owner) surface inline.
 */
export function SharePanel({ open, onClose, kind, targetId, title }: SharePanelProps) {
  const { collaborators, share, setRole, remove } = useSharing(kind, targetId);
  const [email, setEmail] = useState('');
  const [role, setRole_] = useState<ShareRole>('editor');
  // The address the last share was sent to. The share RPC is deliberately
  // generic — it neither confirms nor denies that the email has an account (see
  // migration 20260714230000) — so we show a neutral "if they're an Aurora user"
  // note rather than claiming success against a specific person.
  const [sharedEmail, setSharedEmail] = useState<string | null>(null);

  const emailValid = EMAIL_RE.test(email.trim());

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!emailValid) return;
    const target = email.trim().toLowerCase();
    share.mutate(
      { email: target, role },
      {
        onSuccess: () => {
          setEmail('');
          setSharedEmail(target);
        },
      },
    );
  }

  const list = collaborators.data ?? [];

  return (
    <Modal open={open} onClose={onClose} title={`Share “${title}”`} className="max-w-lg">
      <form onSubmit={submit} className="flex flex-col gap-2.5">
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="collaborator@email.com"
            aria-label="Collaborator email"
            className="flex-1 rounded-xl border border-[var(--glass-border)] bg-[var(--field-bg)] px-3.5 py-2.5 text-sm text-fg placeholder:text-fg-subtle focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--accent-from)]"
          />
          <SegmentedToggle
            label="Role"
            value={role}
            onChange={setRole_}
            options={[
              { value: 'editor', label: 'Editor', icon: <Pencil size={13} /> },
              { value: 'viewer', label: 'Viewer', icon: <Eye size={13} /> },
            ]}
          />
        </div>
        <GradientButton
          type="submit"
          size="sm"
          leftIcon={<UserPlus size={15} />}
          disabled={!emailValid}
          isLoading={share.isPending}
          className="self-start"
        >
          Add collaborator
        </GradientButton>
        {share.isError && (
          <p className="text-xs text-danger">
            {share.error instanceof Error ? share.error.message : 'Could not share.'}
          </p>
        )}
        {share.isSuccess && !share.isError && sharedEmail && (
          <p className="text-xs text-fg-muted" role="status">
            If <span className="font-medium text-fg">{sharedEmail}</span> belongs to an Aurora
            account, they now have access. They'll appear below once they do.
          </p>
        )}
      </form>

      <div className="mt-5 flex flex-col gap-1">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-fg-subtle">
          People with access
        </p>
        {collaborators.isLoading ? (
          <div className="grid place-items-center py-6">
            <Spinner size={22} />
          </div>
        ) : list.length === 0 ? (
          <p className="py-3 text-sm text-fg-muted">
            Only you so far. Add someone above to collaborate.
          </p>
        ) : (
          list.map((person) => (
            <CollaboratorRow
              key={person.userId}
              person={person}
              onSetRole={(r) => setRole.mutate({ userId: person.userId, role: r })}
              onRemove={() => remove.mutate({ userId: person.userId })}
            />
          ))
        )}
      </div>
    </Modal>
  );
}

function CollaboratorRow({
  person,
  onSetRole,
  onRemove,
}: {
  person: Collaborator;
  onSetRole: (role: ShareRole) => void;
  onRemove: () => void;
}) {
  const name = person.displayName || person.email || 'Collaborator';
  const initial = name.charAt(0).toUpperCase();
  return (
    <div className="flex items-center gap-3 rounded-xl px-1 py-1.5">
      {person.avatarUrl ? (
        <img src={person.avatarUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
      ) : (
        <span className="grid h-8 w-8 place-items-center rounded-full bg-[var(--accent-from)]/15 text-sm font-semibold text-[var(--accent-from)]">
          {initial}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-fg">{name}</p>
        {person.email && person.displayName && (
          <p className="truncate text-xs text-fg-subtle">{person.email}</p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {(['editor', 'viewer'] as const).map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => onSetRole(r)}
            className={cn(
              'rounded-lg px-2 py-1 text-xs font-medium transition-colors',
              person.role === r
                ? 'bg-[var(--accent-from)]/15 text-[var(--accent-from)]'
                : 'text-fg-subtle hover:bg-[var(--glass-fill)] hover:text-fg',
            )}
          >
            {r === 'editor' ? 'Editor' : 'Viewer'}
          </button>
        ))}
        <button
          type="button"
          aria-label="Remove"
          onClick={onRemove}
          className="grid h-7 w-7 place-items-center rounded-lg text-fg-subtle transition-colors hover:bg-danger/10 hover:text-danger"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}
