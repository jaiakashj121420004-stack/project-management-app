import { UserCircle2 } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useMembers } from '@/features/members/useMembers';

/**
 * Pick which project member a card is assigned to. The assignee is who due-date
 * reminders are sent to (Phase 9). Members come from the shared useMembers cache
 * (already loaded by the project header), so this is just a styled select.
 */
export function AssigneeField({
  projectId,
  value,
  onChange,
}: {
  projectId: string;
  value: string | null;
  onChange: (next: string | null) => void;
}) {
  const { data } = useMembers(projectId);
  const members = data?.members ?? [];

  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor="card-assignee"
        className="flex items-center gap-2 text-sm font-medium text-fg"
      >
        <UserCircle2 size={16} aria-hidden /> Assignee
      </label>
      <select
        id="card-assignee"
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value || null)}
        className={cn(
          'h-11 rounded-2xl border border-[var(--glass-border)] bg-[var(--field-bg)] px-3.5',
          'text-sm text-fg outline-none transition-colors',
          'focus:border-[color:var(--accent-from)]',
        )}
      >
        <option value="">Unassigned</option>
        {members.map((member) => (
          <option key={member.userId} value={member.userId}>
            {member.displayName ?? 'Member'}
          </option>
        ))}
      </select>
    </div>
  );
}
