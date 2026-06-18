import { forwardRef, type CSSProperties } from 'react';
import { CalendarClock } from 'lucide-react';
import { cn } from '@/lib/cn';

interface CardSurfaceProps {
  title: string;
  description?: string | null;
  /** Reserved for Phase 5 (due dates); shown as a quiet pill when present. */
  dueDate?: string | null;
  /** Render as the lifted drag clone: stronger glow + grab cursor. */
  lifted?: boolean;
  /** Dim the in-list original while its clone is being dragged. */
  dimmed?: boolean;
  className?: string;
  style?: CSSProperties;
  onClick?: () => void;
}

/**
 * Presentational Kanban card: a glass tile carrying the project accent glow
 * (plan.md §4.2/§4.4). Pure and ref-forwarding so it backs both the in-list
 * sortable card and the lifted DragOverlay clone. Layout is intentionally roomy
 * below the title — checklists, labels, due dates, and an assignee avatar slot
 * in here in Phase 5.
 */
export const CardSurface = forwardRef<HTMLDivElement, CardSurfaceProps>(function CardSurface(
  { title, description, dueDate, lifted = false, dimmed = false, className, style, onClick },
  ref,
) {
  return (
    <div
      ref={ref}
      onClick={onClick}
      style={style}
      className={cn(
        'glass rounded-2xl p-3.5 text-left',
        'shadow-[var(--glass-shadow),0_10px_24px_-16px_var(--accent-glow)]',
        'transition-shadow duration-200',
        onClick && 'cursor-pointer',
        'hover:shadow-[var(--glass-shadow),0_16px_30px_-14px_var(--accent-glow)]',
        lifted && 'cursor-grabbing shadow-[var(--glass-shadow-lift),0_28px_50px_-16px_var(--accent-glow)]',
        dimmed && 'opacity-40',
        className,
      )}
    >
      {/* Thin accent strip for a vivid, per-project feel. */}
      <span
        aria-hidden
        className="mb-2.5 block h-1 w-9 rounded-full bg-[linear-gradient(110deg,var(--accent-from),var(--accent-to))]"
      />
      <p className="font-medium leading-snug text-fg">{title}</p>
      {description ? (
        <p className="mt-1.5 line-clamp-2 text-sm text-fg-subtle">{description}</p>
      ) : null}
      {dueDate ? (
        <div className="mt-2.5 inline-flex items-center gap-1.5 text-xs font-medium text-fg-muted">
          <CalendarClock size={13} aria-hidden />
          {dueDate}
        </div>
      ) : null}
    </div>
  );
});
