import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/cn';
import { springs } from '@/lib/motion';

export interface PickerItem {
  id: string;
  title: string;
  /** Small one-line subtitle under the title (snippet, page + time, …). */
  subtitle: string;
}

interface EntityPickerProps {
  items: PickerItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Accessible name for the trigger button. */
  label: string;
  /** Extra classes for the wrapper (e.g. width). */
  className?: string;
}

/**
 * A compact glass dropdown that picks one entity (a note / a canvas) from a
 * list, built on the same `.glass-menu` surface as {@link GlassSelect}. The
 * trigger shows only the selected item's title + a chevron; the popover lists
 * every item with a title and a small subtitle. Closes on select, outside-click,
 * and Escape; fully keyboard-navigable (↑/↓/Home/End to move, Enter/Space to
 * choose). Motion calms under prefers-reduced-motion.
 */
export function EntityPicker({ items, selectedId, onSelect, label, className }: EntityPickerProps) {
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const listId = useId();

  const selectedIndex = items.findIndex((item) => item.id === selectedId);
  const selected = selectedIndex >= 0 ? items[selectedIndex] : undefined;

  // Move focus to the list when it opens so the arrow keys drive it immediately
  // (a DOM side-effect only — the highlighted index is set in `openMenu`).
  useEffect(() => {
    if (open) listRef.current?.focus();
  }, [open]);

  // Close on outside pointer-down.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  // Keep the highlighted option scrolled into view.
  useEffect(() => {
    if (open) optionRefs.current[activeIndex]?.scrollIntoView({ block: 'nearest' });
  }, [open, activeIndex]);

  function choose(id: string) {
    onSelect(id);
    setOpen(false);
  }

  // Open with the selected row pre-highlighted, so the arrow keys move from it.
  function openMenu() {
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
    setOpen(true);
  }

  function onTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      openMenu();
    }
  }

  function onListKeyDown(event: KeyboardEvent<HTMLUListElement>) {
    switch (event.key) {
      case 'Escape':
        event.preventDefault();
        setOpen(false);
        break;
      case 'ArrowDown':
        event.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, items.length - 1));
        break;
      case 'ArrowUp':
        event.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
        break;
      case 'Home':
        event.preventDefault();
        setActiveIndex(0);
        break;
      case 'End':
        event.preventDefault();
        setActiveIndex(items.length - 1);
        break;
      case 'Enter':
      case ' ': {
        event.preventDefault();
        const item = items[activeIndex];
        if (item) choose(item.id);
        break;
      }
    }
  }

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={onTriggerKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        aria-controls={open ? listId : undefined}
        className={cn(
          'flex h-10 w-full items-center justify-between gap-2 rounded-xl border border-[var(--glass-border)] bg-[var(--field-bg)] px-3 text-sm font-medium text-fg',
          'backdrop-blur-sm outline-none transition-colors focus:border-[color:var(--accent-from)] focus:ring-2 focus:ring-[var(--accent-from)]',
        )}
      >
        <span className="truncate">{selected?.title ?? 'Select…'}</span>
        <ChevronDown size={16} className="shrink-0 text-fg-muted" aria-hidden />
      </button>

      <AnimatePresence>
        {open && (
          <motion.ul
            ref={listRef}
            id={listId}
            role="listbox"
            tabIndex={-1}
            aria-label={label}
            aria-activedescendant={items.length ? `${listId}-opt-${activeIndex}` : undefined}
            onKeyDown={onListKeyDown}
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: -4 }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: -4 }}
            transition={springs.snappy}
            className="glass-menu absolute inset-x-0 top-full z-50 mt-1.5 max-h-72 origin-top overflow-auto rounded-2xl p-1 outline-none"
          >
            {items.map((item, index) => {
              const isSelected = item.id === selectedId;
              const isActive = index === activeIndex;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    role="option"
                    id={`${listId}-opt-${index}`}
                    aria-selected={isSelected}
                    ref={(node) => {
                      optionRefs.current[index] = node;
                    }}
                    onClick={() => choose(item.id)}
                    onMouseEnter={() => setActiveIndex(index)}
                    className={cn(
                      'flex w-full items-start justify-between gap-2 rounded-xl px-2.5 py-2 text-left transition-colors',
                      isActive ? 'bg-[var(--glass-fill)]' : 'hover:bg-[var(--glass-fill)]',
                    )}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-fg">
                        {item.title}
                      </span>
                      <span className="block truncate text-xs text-fg-subtle">{item.subtitle}</span>
                    </span>
                    {isSelected && (
                      <Check
                        size={14}
                        className="mt-0.5 shrink-0 text-[var(--accent-from)]"
                        aria-hidden
                      />
                    )}
                  </button>
                </li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
