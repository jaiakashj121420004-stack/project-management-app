import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/cn';

interface ToolbarPopoverProps {
  open: boolean;
  onClose: () => void;
  /** The button that opens the popover (stays in the toolbar). */
  trigger: ReactNode;
  /** Short heading shown in the panel header. */
  title?: string;
  children: ReactNode;
}

/**
 * A viewport-safe popover for editor toolbars. The panel is PORTALED to <body>,
 * so it can never be clipped by a canvas overlay's `overflow-hidden` or an
 * editor's scroll container (the old bug: colour/link panels "half vanishing").
 *
 * - Desktop: anchored just below the trigger, clamped to stay on screen.
 * - Mobile: a clean full-width sheet pinned to the top, with a dimmed backdrop.
 *
 * Always has a close (✕) button, and self-manages outside-tap + Escape to dismiss
 * (so callers don't need their own document listeners).
 */
export function ToolbarPopover({ open, onClose, trigger, title, children }: ToolbarPopoverProps) {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const isMobile = useMediaQuery('(max-width: 640px)');
  const [coords, setCoords] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  useLayoutEffect(() => {
    if (!open || isMobile || !anchorRef.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    const width = 288;
    setCoords({
      top: Math.min(rect.bottom + 6, window.innerHeight - 12),
      left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)),
    });
  }, [open, isMobile]);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (anchorRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      onClose();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  return (
    <span ref={anchorRef} className="relative inline-flex">
      {trigger}
      {open &&
        createPortal(
          <>
            {isMobile && (
              <div className="fixed inset-0 z-[89] bg-black/40 backdrop-blur-[2px]" onPointerDown={onClose} />
            )}
            <div
              ref={panelRef}
              role="dialog"
              className={cn(
                'glass-strong z-[90] rounded-2xl border border-[var(--glass-border)] p-3 shadow-[0_22px_60px_-20px_rgba(0,0,0,0.7)]',
                isMobile
                  ? 'fixed inset-x-3 top-3 max-h-[78vh] overflow-auto'
                  : 'fixed w-[min(18rem,92vw)]',
              )}
              style={isMobile ? undefined : { top: coords.top, left: coords.left }}
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-fg-subtle">
                  {title ?? ''}
                </span>
                <button
                  type="button"
                  aria-label="Close"
                  onPointerDown={(event) => event.preventDefault()}
                  onClick={onClose}
                  className="grid h-7 w-7 place-items-center rounded-lg text-fg-muted transition-colors hover:bg-[var(--glass-fill)] hover:text-fg"
                >
                  <X size={15} />
                </button>
              </div>
              {children}
            </div>
          </>,
          document.body,
        )}
    </span>
  );
}
