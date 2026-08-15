import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
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

/** Gap, in px, between the trigger and the tooltip bubble. */
const GAP = 8;

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
 *
 * The bubble renders through a portal into <body>, positioned with `fixed`
 * coordinates computed from the trigger's bounding box, instead of being an
 * absolutely-positioned child of the trigger. Icon-only controls are often
 * nested inside a small `overflow-hidden` container (e.g. a swipeable to-do
 * row, or a rounded card) — an in-place absolutely-positioned bubble gets
 * silently clipped by that ancestor and never becomes visible even though it
 * mounts. Portaling escapes any such ancestor so the tooltip is always shown.
 */
export function Tooltip({ label, children, side = 'top', className }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const anchorRef = useRef<HTMLSpanElement>(null);
  const timerRef = useRef<number | null>(null);

  function clearTimer() {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  function updatePosition() {
    const el = anchorRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setCoords({
      top: side === 'top' ? rect.top - GAP : rect.bottom + GAP,
      left: rect.left + rect.width / 2,
    });
  }

  function show() {
    updatePosition();
    setVisible(true);
  }

  function hide() {
    setVisible(false);
  }

  function startLongPress() {
    clearTimer();
    timerRef.current = window.setTimeout(show, LONG_PRESS_MS);
  }

  useEffect(() => clearTimer, []);

  // Keep the bubble glued to its trigger if the page scrolls or resizes while
  // it's open (capture:true so this also fires for scrolls on an ancestor
  // scroll container, e.g. <main>, not just window-level scrolling).
  useEffect(() => {
    if (!visible) return;
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  return (
    <span
      ref={anchorRef}
      className={cn('relative inline-flex', className)}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      onTouchStart={startLongPress}
      onTouchEnd={() => {
        clearTimer();
        hide();
      }}
      onTouchMove={clearTimer}
      onTouchCancel={() => {
        clearTimer();
        hide();
      }}
    >
      {children}
      {createPortal(
        <AnimatePresence>
          {visible && coords && (
            <motion.span
              role="tooltip"
              initial={{ opacity: 0, y: side === 'top' ? 4 : -4, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.12 } }}
              transition={springs.snappy}
              style={{
                position: 'fixed',
                top: coords.top,
                left: coords.left,
                transform: side === 'top' ? 'translate(-50%, -100%)' : 'translate(-50%, 0)',
              }}
              className="glass-strong pointer-events-none z-[9999] whitespace-nowrap rounded-lg border border-[var(--glass-border)] px-2.5 py-1 font-mono text-[11px] font-medium uppercase tracking-wide text-fg shadow-[0_10px_24px_-12px_rgba(0,0,0,0.6)]"
            >
              {label}
            </motion.span>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </span>
  );
}
