import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { cn } from '@/lib/cn';
import { accentVars, type AccentName } from '@/lib/accents';
import type { Card } from '@/types/database';

interface TimelineBarFaceProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  card: Card;
  accent: AccentName;
  /** Hide the in-grid source while its drag clone is lifted. */
  dragging?: boolean;
  /** Render as the lifted DragOverlay clone. */
  overlay?: boolean;
}

/**
 * Presentational Gantt bar for one card: an accent-gradient pill spanning its
 * grid columns, title truncated inside. Ref-forwarding so it backs both the
 * in-grid draggable bar and the lifted DragOverlay clone — same split as
 * Calendar's CardChip/DraggableCardChip.
 */
export const TimelineBarFace = forwardRef<HTMLButtonElement, TimelineBarFaceProps>(function TimelineBarFace(
  { card, accent, dragging = false, overlay = false, className, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      style={accentVars(accent)}
      className={cn(
        'flex h-full w-full items-center overflow-hidden rounded-full px-2.5 text-left text-xs font-medium text-[var(--accent-fg)]',
        'bg-[linear-gradient(110deg,var(--accent-from),var(--accent-to))] shadow-[0_6px_14px_-10px_var(--accent-glow)]',
        'transition-[transform,box-shadow] duration-150 hover:-translate-y-px',
        overlay && 'shadow-[var(--glass-shadow-lift),0_18px_34px_-14px_var(--accent-glow)]',
        dragging && 'opacity-0',
        className,
      )}
      {...rest}
    >
      <span className="truncate">{card.title}</span>
    </button>
  );
});

interface DraggableTimelineBarProps {
  card: Card;
  accent: AccentName;
  /** True when the bar's true start/end lies outside the visible month — the
   *  corresponding resize handle is hidden rather than shown in the wrong place. */
  clippedStart?: boolean;
  clippedEnd?: boolean;
  onClick?: () => void;
}

/**
 * A Gantt bar wired to dnd-kit with three independent drag targets: the body
 * (moves start + due together, same as dragging a Calendar chip to a new day)
 * and two edge handles (resize start-only / due-only). Each registers its own
 * draggable id so CalendarPage's onDragEnd can tell them apart via
 * `active.data.current.kind`.
 */
export function DraggableTimelineBar({
  card,
  accent,
  clippedStart = false,
  clippedEnd = false,
  onClick,
}: DraggableTimelineBarProps) {
  const move = useDraggable({ id: card.id, data: { kind: 'timeline-move', card } });
  const start = useDraggable({ id: `${card.id}::start`, data: { kind: 'timeline-start', card } });
  const end = useDraggable({ id: `${card.id}::end`, data: { kind: 'timeline-end', card } });

  return (
    <div className="relative flex h-full items-center">
      <TimelineBarFace
        ref={move.setNodeRef}
        card={card}
        accent={accent}
        dragging={move.isDragging}
        onClick={onClick}
        className="cursor-grab touch-none active:cursor-grabbing"
        {...move.listeners}
        {...move.attributes}
      />
      {!clippedStart && (
        <div
          ref={start.setNodeRef}
          {...start.listeners}
          {...start.attributes}
          aria-label={`Drag to change when "${card.title}" starts`}
          className={cn(
            'absolute left-0 top-0.5 bottom-0.5 w-2.5 cursor-ew-resize touch-none rounded-l-full',
            start.isDragging && 'bg-[var(--accent-fg)]/45',
          )}
        />
      )}
      {!clippedEnd && (
        <div
          ref={end.setNodeRef}
          {...end.listeners}
          {...end.attributes}
          aria-label={`Drag to change when "${card.title}" is due`}
          className={cn(
            'absolute right-0 top-0.5 bottom-0.5 w-2.5 cursor-ew-resize touch-none rounded-r-full',
            end.isDragging && 'bg-[var(--accent-fg)]/45',
          )}
        />
      )}
    </div>
  );
}
