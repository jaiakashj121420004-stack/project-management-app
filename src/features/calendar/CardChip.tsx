import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { cn } from '@/lib/cn';
import { accentVars, type AccentName } from '@/lib/accents';
import { dueStatus, type DueStatus } from '@/features/board/due';
import type { Card } from '@/types/database';

/** Urgency marker: overdue = danger, due-soon = warning, else none (plan.md §4.2). */
const STATUS_DOT: Record<DueStatus, string | null> = {
  overdue: 'bg-danger',
  soon: 'bg-warning',
  upcoming: null,
};

interface CardChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  card: Card;
  accent: AccentName;
  /** Hide the in-grid source while its drag clone is lifted. */
  dragging?: boolean;
  /** Render as the lifted DragOverlay clone. */
  overlay?: boolean;
}

/**
 * A compact calendar chip for one dated card: tinted by its project accent (the
 * left gradient bar) with an urgency dot. Presentational + ref-forwarding so it
 * backs the draggable grid chip, the lifted DragOverlay clone, the agenda rows,
 * and the day-overflow modal. Click opens the shared Phase 5 card modal.
 */
export const CardChip = forwardRef<HTMLButtonElement, CardChipProps>(function CardChip(
  { card, accent, dragging = false, overlay = false, className, ...rest },
  ref,
) {
  const status = card.due_date ? dueStatus(card.due_date) : 'upcoming';
  const dot = STATUS_DOT[status];

  return (
    <button
      ref={ref}
      type="button"
      style={accentVars(accent)}
      className={cn(
        'relative flex w-full items-center gap-1.5 rounded-lg border border-[var(--glass-border)] bg-[var(--glass-fill)] py-1 pl-1.5 pr-2 text-left backdrop-blur-sm',
        'transition-[transform,box-shadow] duration-150',
        'hover:-translate-y-px hover:shadow-[0_8px_18px_-12px_var(--accent-glow)]',
        overlay &&
          'scale-[1.04] cursor-grabbing shadow-[var(--glass-shadow-lift),0_18px_34px_-14px_var(--accent-glow)]',
        dragging && 'opacity-0',
        className,
      )}
      {...rest}
    >
      <span
        aria-hidden
        className="h-3.5 w-1 shrink-0 rounded-full bg-[linear-gradient(180deg,var(--accent-from),var(--accent-to))]"
      />
      <span className="min-w-0 flex-1 truncate text-xs font-medium text-fg">{card.title}</span>
      {dot && <span aria-hidden className={cn('h-1.5 w-1.5 shrink-0 rounded-full', dot)} />}
    </button>
  );
});

interface DraggableCardChipProps {
  card: Card;
  accent: AccentName;
  onClick?: () => void;
}

/**
 * Grid chip wired to dnd-kit. The lifted clone is rendered separately in the
 * page's DragOverlay, so the source is simply hidden (not transformed) while
 * dragging — keeping the only draggable registration for this id here.
 */
export function DraggableCardChip({ card, accent, onClick }: DraggableCardChipProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: card.id,
    data: { card },
  });
  return (
    <CardChip
      ref={setNodeRef}
      card={card}
      accent={accent}
      dragging={isDragging}
      onClick={onClick}
      className="cursor-grab touch-none active:cursor-grabbing"
      {...listeners}
      {...attributes}
    />
  );
}
