import { forwardRef, type CSSProperties } from 'react';
import { CalendarClock } from 'lucide-react';
import { cn } from '@/lib/cn';

interface CardSurfaceProps {
  title: string;
  description?: string | null;
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
 * sortable card and the lifted DragOverlay clone.
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
        'glass group rounded-2xl p-3.5 text-left',
        'shadow-[var(--glass-shadow),0_10px_24px_-16px_var(--accent-glow)]',
        'transition-[transform,box-shadow] duration-200 ease-spring',
        onClick && 'cursor-pointer hover:-translate-y-0.5',
        'hover:shadow-[var(--glass-shadow),0_18px_32px_-14px_var(--accent-glow)]',
        lifted && 'cursor-grabbing shadow-[var(--glass-shadow-lift),0_28px_50px_-16px_var(--accent-glow)]',
        dimmed && 'opacity-40',
        className,
      )}
    >
      <span
        aria-hidden
        className="mb-2.5 block h-1 w-9 rounded-full bg-[linear-gradient(110deg,var(--accent-from),var(--accent-to))] transition-all duration-200 group-hover:w-14"
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
