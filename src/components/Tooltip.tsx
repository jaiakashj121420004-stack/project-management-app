import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/cn';
import { springs } from '@/lib/motion';

interface TooltipProps {
  /** What the icon/control does, e.g. "Edit", "Delete", "Repeat daily". */
  label: string;
  children: ReactNode;
  side?: 'top' | 'bottom';
  className?: string;
}

/** How long a touch must be held before the tooltip reveals (a "deep press"). */
const LONG_PRESS_MS = 450;

/**
 * Universal icon tooltip. Wrap any icon-only control (a button, a badge, a
 * drag handle) so its function is always discoverable:
 *  - Desktop: appears on hover, and on keyboard focus (a11y).
 *  - Mobile / tablet: a long-press ("deep press") reveals the same label in
 *    stylised small-caps mono, then a normal tap still fires the control's own
 *    onClick — the long-press only shows text, it never substitutes for a tap.
 *
 * Purely presentational — it does not intercept clicks, so it's safe to drop
 * around any existing icon button without touching that button's own handlers.
 */
export function Tooltip({ label, children, side = 'top', className }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<number | null>(null);

  function clearTimer() {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  function startLongPress() {
    clearTimer();
    timerRef.current = window.setTimeout(() => setVisible(true), LONG_PRESS_MS);
  }

  useEffect(() => clearTimer, []);

  return (
    <span
      className={cn('relative inline-flex', className)}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
      onTouchStart={startLongPress}
      onTouchEnd={() => {
        clearTimer();
        setVisible(false);
      }}
      onTouchMove={clearTimer}
      onTouchCancel={() => {
        clearTimer();
        setVisible(false);
      }}
    >
      {children}
      <AnimatePresence>
        {visible && (
          <motion.span
            role="tooltip"
            initial={{ opacity: 0, y: side === 'top' ? 4 : -4, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.12 } }}
            transition={springs.snappy}
            className={cn(
              'glass-strong pointer-events-none absolute z-[95] whitespace-nowrap rounded-lg border border-[var(--glass-border)] px-2.5 py-1 font-mono text-[11px] font-medium uppercase tracking-wide text-fg shadow-[0_10px_24px_-12px_rgba(0,0,0,0.6)]',
              side === 'top'
                ? 'bottom-full left-1/2 mb-2 -translate-x-1/2'
                : 'top-full left-1/2 mt-2 -translate-x-1/2',
            )}
          >
            {label}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}
