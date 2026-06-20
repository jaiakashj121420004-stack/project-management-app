import { forwardRef, type CSSProperties } from 'react';
import { CalendarClock, CheckSquare, Flag } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { Label } from '@/types/database';
import { formatPriority, priorityPillClass } from '@/lib/priority';
import { LabelPill } from './LabelPill';
import { dueStatus, formatDueLabel } from './due';

export interface ChecklistProgress {
  done: number;
  total: number;
}

interface CardSurfaceProps {
  title: string;
  description?: string | null;
  /** Due date (YYYY-MM-DD); shown as a pill colored by urgency when present. */
  dueDate?: string | null;
  /** Task priority (1 = P1); shown as a tier-colored pill when present. */
  priority?: number | null;
  /** Labels attached to this card; shown as small swatches above the title. */
  labels?: Label[];
  /** Checklist tally; shown as a "2/5" pill when the card has any items. */
  checklist?: ChecklistProgress | null;
  /** Render as the lifted drag clone: stronger glow + grab cursor. */
  lifted?: boolean;
  /** Dim the in-list original while its clone is being dragged. */
  dimmed?: boolean;
  className?: string;
  style?: CSSProperties;
  onClick?: () => void;
}

const DUE_PILL: Record<ReturnType<typeof dueStatus>, string> = {
  overdue: 'border-danger/30 bg-danger/10 text-danger',
  soon: 'border-warning/30 bg-warning/10 text-warning',
  upcoming: 'border-[var(--glass-border)] bg-[var(--glass-fill)] text-fg-muted',
};

/**
 * Presentational Kanban card: a glass tile carrying the project accent glow
 * (plan.md §4.2/§4.4). Pure and ref-forwarding so it backs both the in-list
 * sortable card and the lifted DragOverlay clone. The face surfaces a card's
 * Phase 5 detail at a glance: label swatches, a urgency-colored due pill, and
 * checklist progress.
 */
export const CardSurface = forwardRef<HTMLDivElement, CardSurfaceProps>(function CardSurface(
  { title, description, dueDate, priority, labels, checklist, lifted = false, dimmed = false, className, style, onClick },
  ref,
) {
  const status = dueDate ? dueStatus(dueDate) : null;
  const hasChecklist = checklist && checklist.total > 0;
  const hasPriority = priority != null;

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
      {labels && labels.length > 0 ? (
        <div className="mb-2 flex flex-wrap gap-x-3 gap-y-1">
          {labels.map((label) => (
            <LabelPill key={label.id} name={label.name} color={label.color} variant="dot" />
          ))}
        </div>
      ) : (
        // Thin accent strip when there are no labels, for a vivid per-project feel.
        <span
          aria-hidden
          className="mb-2.5 block h-1 w-9 rounded-full bg-[linear-gradient(110deg,var(--accent-from),var(--accent-to))]"
        />
      )}

      <p className="font-medium leading-snug text-fg">{title}</p>
      {description ? (
        <p className="mt-1.5 line-clamp-2 text-sm text-fg-subtle">{description}</p>
      ) : null}

      {(status || hasChecklist || hasPriority) && (
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          {priority != null ? (
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold',
                priorityPillClass(priority),
              )}
            >
              <Flag size={11} aria-hidden />
              {formatPriority(priority)}
            </span>
          ) : null}
          {status && dueDate ? (
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium',
                DUE_PILL[status],
              )}
            >
              <CalendarClock size={12} aria-hidden />
              {formatDueLabel(dueDate)}
            </span>
          ) : null}
          {hasChecklist ? (
            <span
              className={cn(
                'inline-flex items-center gap-1 text-xs font-medium',
                checklist.done === checklist.total ? 'text-success' : 'text-fg-muted',
              )}
            >
              <CheckSquare size={13} aria-hidden />
              {checklist.done}/{checklist.total}
            </span>
          ) : null}
        </div>
      )}
    </div>
  );
});
