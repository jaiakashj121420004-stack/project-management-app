import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/cn';
import { springs } from '@/lib/motion';

/**
 * A custom dropdown on the opaque `.glass-menu` surface — the app's standard
 * replacement for a native `<select>`, whose OS-drawn option list can't be
 * recoloured and is illegible on the dark theme (see the AssigneeField /
 * RoleControl decision-log note). Generic over the option value so it works for
 * strings (project scope, channel) and numbers (lead days, offset units) alike.
 *
 * Keyboard/pointer behaviour mirrors the existing custom dropdowns: click the
 * trigger to toggle, click-outside or Escape to close, the selected option is
 * checked. `openUp` flips the menu above the trigger for bottom-of-panel use.
 */
export interface GlassSelectOption<T extends string | number> {
  value: T;
  label: ReactNode;
}

interface GlassSelectProps<T extends string | number> {
  value: T;
  onChange: (value: T) => void;
  options: GlassSelectOption<T>[];
  /** Accessible name for the trigger button. */
  label: string;
  disabled?: boolean;
  size?: 'sm' | 'md';
  openUp?: boolean;
  /** Extra classes for the trigger (e.g. width). */
  className?: string;
  /** Menu width; defaults to matching the trigger. */
  menuClassName?: string;
}

export function GlassSelect<T extends string | number>({
  value,
  onChange,
  options,
  label,
  disabled,
  size = 'md',
  openUp = false,
  className,
  menuClassName,
}: GlassSelectProps<T>) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const listId = useId();

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

  const selected = options.find((option) => option.value === value);

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        aria-controls={open ? listId : undefined}
        className={cn(
          'flex w-full items-center justify-between gap-2 border border-[var(--glass-border)] bg-[var(--field-bg)] font-medium text-fg',
          'backdrop-blur-sm outline-none transition-colors focus:border-[color:var(--accent-from)] focus:ring-2 focus:ring-[var(--accent-from)]',
          'disabled:cursor-not-allowed disabled:opacity-50',
          size === 'md' ? 'h-10 rounded-xl px-3 text-sm' : 'h-8 rounded-lg px-2.5 text-sm',
        )}
      >
        <span className="truncate">{selected?.label ?? ''}</span>
        <ChevronDown size={16} className="shrink-0 text-fg-muted" aria-hidden />
      </button>

      <AnimatePresence>
        {open && (
          <motion.ul
            id={listId}
            role="listbox"
            initial={{ opacity: 0, scale: 0.97, y: openUp ? 4 : -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: openUp ? 4 : -4 }}
            transition={springs.snappy}
            className={cn(
              'glass-menu absolute inset-x-0 z-50 max-h-60 overflow-auto rounded-2xl p-1',
              openUp ? 'bottom-full mb-1.5 origin-bottom' : 'top-full mt-1.5 origin-top',
              menuClassName,
            )}
          >
            {options.map((option) => (
              <li key={String(option.value)}>
                <button
                  type="button"
                  role="option"
                  aria-selected={option.value === value}
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  className={cn(
                    'flex w-full items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-left text-sm font-medium transition-colors',
                    option.value === value
                      ? 'text-fg'
                      : 'text-fg-muted hover:bg-[var(--glass-fill)] hover:text-fg',
                  )}
                >
                  <span className="truncate">{option.label}</span>
                  {option.value === value && (
                    <Check size={14} className="shrink-0 text-[var(--accent-from)]" aria-hidden />
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
