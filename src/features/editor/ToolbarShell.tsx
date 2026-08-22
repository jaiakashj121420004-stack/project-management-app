import { useEffect, useState, type ReactNode } from 'react';
import { ChevronDown, Type } from 'lucide-react';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/cn';

interface ToolbarShellProps {
  /** aria-label for the inner `role="toolbar"` row (accessibility only). */
  label: string;
  children: ReactNode;
  className?: string;
}

/**
 * Shared collapsible chrome for the two rich-text toolbars (notes'
 * EditorToolbar and canvas' TextFormatToolbar) — same schema, same buttons
 * pattern, so the "make the toolbar collapsible on mobile" fix lives in one
 * place instead of being duplicated per surface.
 *
 * On a phone (`max-width: 640px`, matching ToolbarPopover's own breakpoint)
 * the full button row is collapsed behind a single "Format" pill by default —
 * ~30 icon buttons wrapping onto 3-4 rows was eating most of a phone screen
 * before every note/canvas edit. Tapping the pill expands the row in place;
 * tapping again collapses it. On desktop/tablet there's room, so the pill
 * never renders and the row is always open — no behaviour change there.
 */
export function ToolbarShell({ label, children, className }: ToolbarShellProps) {
  const isMobile = useMediaQuery('(max-width: 640px)');
  const [expanded, setExpanded] = useState(!isMobile);

  // Crossing the breakpoint (rotate, resize) always lands on "open" — a
  // collapsed toolbar should never persist onto a desktop-sized viewport.
  useEffect(() => {
    if (!isMobile) setExpanded(true);
  }, [isMobile]);

  return (
    <div
      className={cn(
        'glass-menu sticky top-0 z-10 max-w-full overflow-hidden rounded-xl border border-[var(--glass-border)]',
        className,
      )}
    >
      {isMobile && (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((e) => !e)}
          className="flex w-full items-center justify-between gap-2 px-3 py-2 text-sm font-medium text-fg-muted transition-colors active:bg-[var(--glass-fill)]"
        >
          <span className="flex items-center gap-1.5">
            <Type size={15} />
            Format
          </span>
          <ChevronDown size={15} className={cn('transition-transform', expanded && 'rotate-180')} />
        </button>
      )}
      {expanded && (
        <div
          role="toolbar"
          aria-label={label}
          className={cn(
            'flex max-w-full flex-wrap items-center gap-1.5 px-1.5 py-1.5',
            isMobile && 'border-t border-[var(--glass-border)]',
          )}
        >
          {children}
        </div>
      )}
    </div>
  );
}
