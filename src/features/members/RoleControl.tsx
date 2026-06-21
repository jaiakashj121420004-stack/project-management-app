import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Badge } from '@/components/Badge';
import { springs } from '@/lib/motion';
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

/**
 * Owner-only role selector (editor ↔ viewer). A custom dropdown rather than a
 * native <select>: the OS-drawn <option> list can't be rounded or recoloured,
 * which left it sharp-cornered and only legible on hover. This renders on the
 * opaque menu surface so it's readable in both themes. `openUp` flips it above
 * the trigger (used in the invite form, which sits at the bottom of the panel).
 */
export function RoleSelect({
  value,
  onChange,
  disabled,
  size = 'sm',
  openUp = false,
}: {
  value: InvitationRole;
  onChange: (role: InvitationRole) => void;
  disabled?: boolean;
  size?: 'sm' | 'md';
  openUp?: boolean;
}) {
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

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Member role"
        className={cn(
          'flex items-center justify-between gap-1.5 border border-[var(--glass-border)] bg-[var(--field-bg)] text-sm font-medium text-fg',
          'backdrop-blur-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent-from)]',
          'disabled:cursor-not-allowed disabled:opacity-60',
          size === 'md' ? 'h-11 rounded-2xl px-3' : 'h-8 rounded-xl px-2.5',
        )}
      >
        {ROLE_LABEL[value]}
        <ChevronDown size={size === 'md' ? 16 : 14} className="text-fg-muted" aria-hidden />
      </button>

      <AnimatePresence>
        {open && (
          <motion.ul
            role="listbox"
            initial={{ opacity: 0, scale: 0.96, y: openUp ? 4 : -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: openUp ? 4 : -4 }}
            transition={springs.snappy}
            className={cn(
              'glass-menu absolute right-0 z-50 w-40 overflow-hidden rounded-2xl p-1',
              openUp ? 'bottom-full mb-1.5 origin-bottom-right' : 'top-full mt-1.5 origin-top-right',
            )}
          >
            {INVITE_ROLES.map((role) => (
              <li key={role}>
                <button
                  type="button"
                  role="option"
                  aria-selected={role === value}
                  onClick={() => {
                    onChange(role);
                    setOpen(false);
                  }}
                  className={cn(
                    'flex w-full items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-left text-sm font-medium transition-colors',
                    role === value
                      ? 'text-fg'
                      : 'text-fg-muted hover:bg-[var(--glass-fill)] hover:text-fg',
                  )}
                >
                  {ROLE_LABEL[role]}
                  {role === value && (
                    <Check size={14} className="text-[var(--accent-from)]" aria-hidden />
                  )}
                </button>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}

export { ROLE_LABEL };
