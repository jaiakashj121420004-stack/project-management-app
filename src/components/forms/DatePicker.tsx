import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { CalendarClock, ChevronDown, ChevronLeft, ChevronRight, Clock, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { springs } from '@/lib/motion';
import { formatClockTime } from '@/lib/dueAt';
import { GlassSelect, type GlassSelectOption } from './GlassSelect';

/**
 * On-brand date (and optional time) picker — the app's replacement for the
 * native <input type="date">/<input type="time">, whose OS-drawn calendar/clock
 * popups ignore the Aurora design (same reasoning as GlassSelect vs <select>).
 *
 * It keeps the SAME value contract as the old native inputs — date as
 * 'YYYY-MM-DD', time as 'HH:mm', via onChange/onTimeChange — so callers are
 * unchanged. A glass disclosure (not an absolute popover) expands in-flow below
 * the trigger so it never clips inside a scrolling modal; the month grid is
 * pure date-fns, fully keyboard-navigable (arrows/Enter/Esc/PageUp·Down), works
 * on touch, themes light+dark, and calms its motion under prefers-reduced-motion.
 */

interface DatePickerProps {
  /** Selected date as 'YYYY-MM-DD', or null. */
  value: string | null;
  onChange: (value: string | null) => void;
  /** Accessible name + fallback trigger text context. */
  label: string;
  placeholder?: string;
  disabled?: boolean;
  /** Show the inline time selector (drives an 'HH:mm' value via onTimeChange). */
  showTime?: boolean;
  /** Selected time as 'HH:mm', or null. Only meaningful when `showTime`. */
  time?: string | null;
  onTimeChange?: (time: string | null) => void;
  /** Extra classes for the trigger button. */
  className?: string;
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const HOUR_OPTIONS: GlassSelectOption<number>[] = Array.from({ length: 12 }, (_, i) => ({
  value: i + 1,
  label: String(i + 1),
}));
const MINUTE_OPTIONS: GlassSelectOption<number>[] = Array.from({ length: 60 }, (_, i) => ({
  value: i,
  label: String(i).padStart(2, '0'),
}));
const MERIDIEM_OPTIONS: GlassSelectOption<'AM' | 'PM'>[] = [
  { value: 'AM', label: 'AM' },
  { value: 'PM', label: 'PM' },
];

const toKey = (date: Date): string => format(date, 'yyyy-MM-dd');

/** The full weeks (incl. leading/trailing days) covering `cursor`'s month. */
function monthMatrix(cursor: Date): Date[] {
  return eachDayOfInterval({
    start: startOfWeek(startOfMonth(cursor)),
    end: endOfWeek(endOfMonth(cursor)),
  });
}

function parse12(hhmm: string): { h12: number; minute: number; meridiem: 'AM' | 'PM' } {
  const [hRaw, mRaw] = hhmm.split(':');
  const hour = Number(hRaw ?? '0');
  const minute = Number(mRaw ?? '0');
  return {
    h12: hour % 12 === 0 ? 12 : hour % 12,
    minute,
    meridiem: hour >= 12 ? 'PM' : 'AM',
  };
}

function build24(h12: number, minute: number, meridiem: 'AM' | 'PM'): string {
  const base = h12 % 12;
  const hour = meridiem === 'PM' ? base + 12 : base;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export function DatePicker({
  value,
  onChange,
  label,
  placeholder = 'Select a date',
  disabled,
  showTime,
  time,
  onTimeChange,
  className,
}: DatePickerProps) {
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState<Date>(() =>
    startOfMonth(value ? parseISO(value) : new Date()),
  );
  const [focusedKey, setFocusedKey] = useState<string>(() => value ?? toKey(new Date()));

  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dayRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  // Only steal focus into the grid when the user is driving with the keyboard,
  // so mouse month-nav doesn't yank focus off the pointer.
  const keyboardNav = useRef(false);

  const todayKey = toKey(new Date());

  function openPicker() {
    const base = value ? parseISO(value) : new Date();
    setViewMonth(startOfMonth(base));
    setFocusedKey(value ?? todayKey);
    keyboardNav.current = true;
    setOpen(true);
  }

  function close(focusTrigger = false) {
    setOpen(false);
    if (focusTrigger) triggerRef.current?.focus();
  }

  // Close on outside click; close on Escape (capture phase + stopImmediate so the
  // surrounding Modal's Escape-to-close listener never also fires).
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) close();
    };
    const onEscapeCapture = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopImmediatePropagation();
        event.preventDefault();
        close(true);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onEscapeCapture, true);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onEscapeCapture, true);
    };
  }, [open]);

  // Move keyboard focus to the active day when navigating by keyboard.
  useEffect(() => {
    if (!open || !keyboardNav.current) return;
    dayRefs.current.get(focusedKey)?.focus();
  }, [open, focusedKey, viewMonth]);

  function selectDay(date: Date) {
    onChange(toKey(date));
    setFocusedKey(toKey(date));
    if (!isSameMonth(date, viewMonth)) setViewMonth(startOfMonth(date));
    if (!showTime) close(true); // time mode stays open so a time can be added
  }

  function moveFocus(deltaDays: number) {
    keyboardNav.current = true;
    const next = addDays(parseISO(focusedKey), deltaDays);
    setFocusedKey(toKey(next));
    if (!isSameMonth(next, viewMonth)) setViewMonth(startOfMonth(next));
  }

  function onGridKeyDown(event: ReactKeyboardEvent) {
    switch (event.key) {
      case 'ArrowLeft':
        event.preventDefault();
        moveFocus(-1);
        break;
      case 'ArrowRight':
        event.preventDefault();
        moveFocus(1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        moveFocus(-7);
        break;
      case 'ArrowDown':
        event.preventDefault();
        moveFocus(7);
        break;
      case 'PageUp':
        event.preventDefault();
        keyboardNav.current = true;
        setFocusedKey(toKey(addMonths(parseISO(focusedKey), -1)));
        setViewMonth((m) => addMonths(m, -1));
        break;
      case 'PageDown':
        event.preventDefault();
        keyboardNav.current = true;
        setFocusedKey(toKey(addMonths(parseISO(focusedKey), 1)));
        setViewMonth((m) => addMonths(m, 1));
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        selectDay(parseISO(focusedKey));
        break;
      default:
        break;
    }
  }

  const days = monthMatrix(viewMonth);
  const triggerText = value
    ? `${format(parseISO(value), 'EEE, MMM d, yyyy')}${
        showTime && time ? ` · ${formatClockTime(time)}` : ''
      }`
    : placeholder;

  return (
    <div ref={rootRef} className="relative flex flex-col gap-2">
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => (open ? close() : openPicker())}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={label}
        className={cn(
          'flex h-11 w-full items-center justify-between gap-2 rounded-2xl border border-[var(--glass-border)] bg-[var(--field-bg)] px-3.5 text-left text-sm text-fg',
          'backdrop-blur-sm outline-none transition-colors focus:border-[color:var(--accent-from)] focus:ring-2 focus:ring-[var(--accent-from)]',
          'disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
      >
        <span className="flex min-w-0 items-center gap-2">
          <CalendarClock size={16} className="shrink-0 text-fg-muted" aria-hidden />
          <span className={cn('truncate', !value && 'text-fg-muted')}>{triggerText}</span>
        </span>
        <ChevronDown
          size={16}
          aria-hidden
          className={cn('shrink-0 text-fg-muted transition-transform', open && 'rotate-180')}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="dialog"
            aria-label={label}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.98 }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.98 }}
            transition={springs.snappy}
            className="glass-menu z-20 w-[19rem] max-w-[calc(100vw-3rem)] origin-top rounded-2xl p-3"
          >
            <div className="mb-2 flex items-center justify-between">
              <IconButton label="Previous month" onClick={() => setViewMonth((m) => addMonths(m, -1))}>
                <ChevronLeft size={18} />
              </IconButton>
              <span className="font-display text-sm font-semibold text-fg">
                {format(viewMonth, 'MMMM yyyy')}
              </span>
              <IconButton label="Next month" onClick={() => setViewMonth((m) => addMonths(m, 1))}>
                <ChevronRight size={18} />
              </IconButton>
            </div>

            <div className="mb-1 grid grid-cols-7 gap-0.5">
              {WEEKDAYS.map((name) => (
                <span
                  key={name}
                  aria-hidden
                  className="grid h-7 place-items-center text-xs font-medium text-fg-subtle"
                >
                  {name.slice(0, 2)}
                </span>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-0.5">
              {days.map((day) => {
                const key = toKey(day);
                const selected = value === key;
                const inMonth = isSameMonth(day, viewMonth);
                const isTodayCell = key === todayKey;
                return (
                  <button
                    key={key}
                    ref={(el) => {
                      if (el) dayRefs.current.set(key, el);
                      else dayRefs.current.delete(key);
                    }}
                    type="button"
                    aria-label={format(day, 'EEEE, MMMM d, yyyy')}
                    aria-pressed={selected}
                    aria-current={isTodayCell ? 'date' : undefined}
                    tabIndex={key === focusedKey ? 0 : -1}
                    onKeyDown={onGridKeyDown}
                    onClick={() => {
                      keyboardNav.current = false;
                      selectDay(day);
                    }}
                    className={cn(
                      'mx-auto grid h-9 w-9 place-items-center rounded-xl text-sm transition-colors',
                      selected
                        ? 'bg-[linear-gradient(135deg,var(--accent-from),var(--accent-to))] font-semibold text-[var(--accent-fg)] shadow-[0_8px_18px_-10px_var(--accent-glow)]'
                        : isTodayCell
                          ? 'font-bold text-[color:var(--accent-from)] hover:bg-[var(--glass-fill)]'
                          : inMonth
                            ? 'text-fg hover:bg-[var(--glass-fill)]'
                            : 'text-fg-subtle hover:bg-[var(--glass-fill)]',
                    )}
                  >
                    {format(day, 'd')}
                  </button>
                );
              })}
            </div>

            {showTime && value && (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--glass-border)] pt-3">
                <span className="flex items-center gap-1.5 text-xs font-medium text-fg-muted">
                  <Clock size={14} aria-hidden /> Time
                </span>
                {time ? (
                  <div className="flex items-center gap-1.5">
                    <TimeSelector time={time} onChange={(next) => onTimeChange?.(next)} />
                    <button
                      type="button"
                      onClick={() => onTimeChange?.(null)}
                      aria-label="Clear time"
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-fg-subtle transition-colors hover:bg-danger/10 hover:text-danger"
                    >
                      <X size={15} />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => onTimeChange?.('09:00')}
                    className="rounded-lg border border-[var(--glass-border)] px-2.5 py-1 text-xs font-medium text-fg-muted transition-colors hover:border-[color:var(--accent-from)] hover:text-fg"
                  >
                    + Add time
                  </button>
                )}
              </div>
            )}

            <div className="mt-3 flex items-center justify-between gap-2 border-t border-[var(--glass-border)] pt-3">
              <button
                type="button"
                onClick={() => {
                  keyboardNav.current = false;
                  selectDay(new Date());
                }}
                className="text-sm font-medium text-fg-muted transition-colors hover:text-fg"
              >
                Today
              </button>
              <div className="flex items-center gap-3">
                {value && (
                  <button
                    type="button"
                    onClick={() => {
                      onChange(null);
                      onTimeChange?.(null);
                      close(true);
                    }}
                    className="text-sm font-medium text-fg-muted transition-colors hover:text-danger"
                  >
                    Clear
                  </button>
                )}
                {showTime && (
                  <button
                    type="button"
                    onClick={() => close(true)}
                    className="text-sm font-semibold text-[color:var(--accent-from)] transition-opacity hover:opacity-80"
                  >
                    Done
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Hour / minute / AM-PM dropdowns that read+write an 'HH:mm' string. */
function TimeSelector({ time, onChange }: { time: string; onChange: (time: string) => void }) {
  const { h12, minute, meridiem } = parse12(time);
  return (
    <div className="flex items-center gap-1">
      <GlassSelect
        label="Hour"
        size="sm"
        openUp
        value={h12}
        onChange={(next) => onChange(build24(next, minute, meridiem))}
        options={HOUR_OPTIONS}
        className="w-[3.5rem]"
      />
      <span className="text-fg-muted">:</span>
      <GlassSelect
        label="Minute"
        size="sm"
        openUp
        value={minute}
        onChange={(next) => onChange(build24(h12, next, meridiem))}
        options={MINUTE_OPTIONS}
        className="w-[3.75rem]"
      />
      <GlassSelect
        label="AM or PM"
        size="sm"
        openUp
        value={meridiem}
        onChange={(next) => onChange(build24(h12, minute, next))}
        options={MERIDIEM_OPTIONS}
        className="w-[4rem]"
      />
    </div>
  );
}

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="grid h-8 w-8 place-items-center rounded-lg text-fg-muted transition-colors hover:bg-[var(--glass-fill)] hover:text-fg"
    >
      {children}
    </button>
  );
}
