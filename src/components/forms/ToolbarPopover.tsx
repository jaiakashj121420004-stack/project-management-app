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
  const [coords, setCoords] = useState<{ top: number; left: number; maxHeight: number }>({
    top: 0,
    left: 0,
    maxHeight: 480,
  });

  // Measure the real panel, then place it below the trigger — or above when
  // there isn't room — and clamp it inside the visible viewport (which an
  // on-screen keyboard shrinks), so it can never run off the bottom.
  useLayoutEffect(() => {
    if (!open || isMobile || !anchorRef.current) return;
    const place = () => {
      const anchor = anchorRef.current;
      if (!anchor) return;
      const rect = anchor.getBoundingClientRect();
      const vv = window.visualViewport;
      const vTop = (vv?.offsetTop ?? 0) + 8;
      const vBottom = (vv?.offsetTop ?? 0) + (vv?.height ?? window.innerHeight) - 8;
      const vw = vv?.width ?? window.innerWidth;
      const width = 288;
      const natural = panelRef.current?.offsetHeight ?? 320;
      const below = vBottom - (rect.bottom + 6);
      const above = rect.top - 6 - vTop;
      const up = natural > below && above > below;
      const maxHeight = Math.max(160, Math.min(natural, up ? above : below));
      const height = Math.min(natural, maxHeight);
      const top = up ? rect.top - 6 - height : rect.bottom + 6;
      setCoords({
        top: Math.max(vTop, Math.min(top, vBottom - height)),
        left: Math.max(8, Math.min(rect.left, vw - width - 8)),
        maxHeight,
      });
    };
    place();
    window.addEventListener('resize', place);
    window.visualViewport?.addEventListener('resize', place);
    return () => {
      window.removeEventListener('resize', place);
      window.visualViewport?.removeEventListener('resize', place);
    };
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
                  : 'fixed w-[min(18rem,92vw)] overflow-auto',
              )}
              style={
                isMobile ? undefined : { top: coords.top, left: coords.left, maxHeight: coords.maxHeight }
              }
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
