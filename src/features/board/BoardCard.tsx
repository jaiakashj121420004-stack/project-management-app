import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Card, Label } from '@/types/database';
import { cn } from '@/lib/cn';
import { CardSurface, type ChecklistProgress } from './CardSurface';

/** The Phase 5 detail a card shows on its face: labels + checklist tally. */
export interface CardFace {
  labels: Label[];
  checklist: ChecklistProgress | null;
}

interface BoardCardProps {
  card: Card;
  face: CardFace | undefined;
  /** Filtered out by the board toolbar — kept mounted but visually hidden so
   *  drag ordering (which reads the full list) stays correct. */
  hidden?: boolean;
  onOpen: () => void;
}

/**
 * A draggable card in a column. useSortable drives reorder + cross-column moves;
 * the lifted clone is rendered separately by the board's DragOverlay, so the
 * in-list original simply dims (`isDragging`) while it's being moved.
 *
 * No `touch-action: none` here on purpose: the touch sensor uses a press delay,
 * so a quick tap opens the card and a vertical swipe still scrolls the column —
 * only a long-press starts a drag.
 */
export function BoardCard({ card, face, hidden = false, onOpen }: BoardCardProps) {
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({
    id: card.id,
    data: { type: 'card', columnId: card.column_id },
  });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn('list-none animate-fade-in', hidden && 'hidden')}
      {...attributes}
      {...listeners}
    >
      <CardSurface
        title={card.title}
        description={card.description}
        dueDate={card.due_date}
        priority={card.priority}
        reviewStatus={card.review_status}
        labels={face?.labels}
        checklist={face?.checklist}
        dimmed={isDragging}
        onClick={onOpen}
      />
    </li>
  );
}
