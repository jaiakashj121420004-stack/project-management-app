import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react';
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
 * Implements the WAI-ARIA collapsible-listbox pattern (Phase 3, a11y): focus
 * stays on the trigger, which owns `aria-activedescendant`; ↑/↓/Home/End move
 * the active option, Enter/Space select it, Esc closes, and printable keys do
 * type-ahead. `openUp` flips the menu above the trigger for bottom-of-panel use.
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

/** Best-effort text for type-ahead: the label when it's a plain string. */
function optionText<T extends string | number>(option: GlassSelectOption<T>): string {
  return (typeof option.label === 'string' ? option.label : String(option.value)).toLowerCase();
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
  const [activeIndex, setActiveIndex] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listId = useId();
  const optionId = (i: number) => `${listId}-opt-${i}`;

  const selectedIndex = options.findIndex((option) => option.value === value);

  // Type-ahead buffer, cleared after a short idle.
  const typeahead = useRef<{ text: string; timer: number | undefined }>({
    text: '',
    timer: undefined,
  });

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  // Keep the active option scrolled into view while navigating.
  useEffect(() => {
    if (!open) return;
    document.getElementById(`${listId}-opt-${activeIndex}`)?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, open, listId]);

  // Open the menu with the active option seeded to the current selection.
  function openMenu() {
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
    setOpen(true);
  }

  function commit(index: number) {
    const option = options[index];
    if (!option) return;
    onChange(option.value);
    setOpen(false);
    buttonRef.current?.focus();
  }

  function runTypeahead(char: string) {
    const state = typeahead.current;
    window.clearTimeout(state.timer);
    state.text += char.toLowerCase();
    state.timer = window.setTimeout(() => {
      state.text = '';
    }, 500);
    const match = options.findIndex((option) => optionText(option).startsWith(state.text));
    if (match >= 0) setActiveIndex(match);
  }

  function onKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (disabled) return;
    const { key } = event;

    if (!open) {
      if (key === 'ArrowDown' || key === 'ArrowUp' || key === 'Enter' || key === ' ') {
        event.preventDefault();
        openMenu();
      }
      return;
    }

    if (key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((i) => (options.length ? (i + 1) % options.length : 0));
    } else if (key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((i) => (options.length ? (i + options.length - 1) % options.length : 0));
    } else if (key === 'Home') {
      event.preventDefault();
      setActiveIndex(0);
    } else if (key === 'End') {
      event.preventDefault();
      setActiveIndex(options.length - 1);
    } else if (key === 'Enter' || key === ' ') {
      event.preventDefault();
      commit(activeIndex);
    } else if (key === 'Escape') {
      event.preventDefault();
      setOpen(false);
    } else if (key === 'Tab') {
      setOpen(false);
    } else if (key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
      runTypeahead(key);
    }
  }

  const selected = options[selectedIndex];

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={onKeyDown}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open ? optionId(activeIndex) : undefined}
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
            aria-label={label}
            aria-activedescendant={optionId(activeIndex)}
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
            {options.map((option, i) => (
              <li key={String(option.value)}>
                <button
                  id={optionId(i)}
                  type="button"
                  role="option"
                  aria-selected={option.value === value}
                  tabIndex={-1}
                  onMouseEnter={() => setActiveIndex(i)}
                  onClick={() => commit(i)}
                  className={cn(
                    'flex w-full items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-left text-sm font-medium transition-colors',
                    i === activeIndex
                      ? 'bg-[var(--glass-fill)] text-fg'
                      : option.value === value
                        ? 'text-fg'
                        : 'text-fg-muted',
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
