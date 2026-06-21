import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronDown, UserCircle2 } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Avatar } from '@/components/Avatar';
import { springs } from '@/lib/motion';
import { useMembers } from '@/features/members/useMembers';

/**
 * Pick which project member a card is assigned to (the assignee is who due-date
 * reminders go to, Phase 9). A custom dropdown rather than a native <select> so
 * the menu is rounded, legible in both themes, and can show member avatars.
 * Members come from the shared useMembers cache (already loaded by the header).
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
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const selected = members.find((member) => member.userId === value) ?? null;

  function pick(next: string | null) {
    onChange(next);
    setOpen(false);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="flex items-center gap-2 text-sm font-medium text-fg">
        <UserCircle2 size={16} aria-hidden /> Assignee
      </span>
      <div ref={ref} className="relative">
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label="Assignee"
          className={cn(
            'flex h-11 w-full items-center justify-between gap-2 rounded-2xl border border-[var(--glass-border)] bg-[var(--field-bg)] px-3.5',
            'text-sm text-fg outline-none transition-colors focus:border-[color:var(--accent-from)] focus:ring-2 focus:ring-[var(--accent-from)]',
          )}
        >
          <span className="flex min-w-0 items-center gap-2">
            {selected ? (
              <>
                <Avatar name={selected.displayName ?? 'Member'} src={selected.avatarUrl} size={22} />
                <span className="truncate">{selected.displayName ?? 'Member'}</span>
              </>
            ) : (
              <span className="text-fg-muted">Unassigned</span>
            )}
          </span>
          <ChevronDown size={16} className="shrink-0 text-fg-muted" aria-hidden />
        </button>

        <AnimatePresence>
          {open && (
            <motion.ul
              role="listbox"
              initial={{ opacity: 0, scale: 0.98, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: -4 }}
              transition={springs.snappy}
              className="glass-menu absolute inset-x-0 top-full z-50 mt-1.5 max-h-56 origin-top overflow-auto rounded-2xl p-1"
            >
              <AssigneeOption label="Unassigned" selected={value === null} onClick={() => pick(null)} />
              {members.map((member) => (
                <AssigneeOption
                  key={member.userId}
                  label={member.displayName ?? 'Member'}
                  avatarUrl={member.avatarUrl}
                  selected={member.userId === value}
                  onClick={() => pick(member.userId)}
                />
              ))}
            </motion.ul>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function AssigneeOption({
  label,
  avatarUrl,
  selected,
  onClick,
}: {
  label: string;
  avatarUrl?: string | null;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        role="option"
        aria-selected={selected}
        onClick={onClick}
        className={cn(
          'flex w-full items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-left text-sm font-medium transition-colors',
          selected ? 'text-fg' : 'text-fg-muted hover:bg-[var(--glass-fill)] hover:text-fg',
        )}
      >
        <span className="flex min-w-0 items-center gap-2">
          {avatarUrl === undefined ? (
            <span className="grid h-[22px] w-[22px] place-items-center rounded-full bg-[var(--glass-fill)] text-fg-subtle">
              <UserCircle2 size={14} aria-hidden />
            </span>
          ) : (
            <Avatar name={label} src={avatarUrl} size={22} />
          )}
          <span className="truncate">{label}</span>
        </span>
        {selected && <Check size={14} className="shrink-0 text-[var(--accent-from)]" aria-hidden />}
      </button>
    </li>
  );
}
