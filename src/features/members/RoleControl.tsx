import { cn } from '@/lib/cn';
import { Badge } from '@/components/Badge';
import { INVITE_ROLES } from './schemas';
import type { InvitationRole, ProjectRole } from '@/types/database';

const ROLE_LABEL: Record<ProjectRole, string> = {
  owner: 'Owner',
  editor: 'Editor',
  viewer: 'Viewer',
};

const ROLE_TONE: Record<ProjectRole, 'accent' | 'info' | 'neutral'> = {
  owner: 'accent',
  editor: 'info',
  viewer: 'neutral',
};

/** A static, read-only role pill. */
export function RoleBadge({ role }: { role: ProjectRole }) {
  return <Badge tone={ROLE_TONE[role]}>{ROLE_LABEL[role]}</Badge>;
}

/** Owner-only role selector for a non-owner member (editor ↔ viewer). */
export function RoleSelect({
  value,
  onChange,
  disabled,
}: {
  value: InvitationRole;
  onChange: (role: InvitationRole) => void;
  disabled?: boolean;
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value as InvitationRole)}
      aria-label="Member role"
      className={cn(
        'h-8 rounded-xl border border-[var(--glass-border)] bg-[var(--field-bg)] px-2.5 text-sm font-medium text-fg',
        'backdrop-blur-sm transition-colors focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--accent-from)]',
        'disabled:opacity-60',
      )}
    >
      {INVITE_ROLES.map((role) => (
        <option key={role} value={role}>
          {ROLE_LABEL[role]}
        </option>
      ))}
    </select>
  );
}

export { ROLE_LABEL };
