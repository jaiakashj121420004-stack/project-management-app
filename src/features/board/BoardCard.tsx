import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Card } from '@/types/database';
import { CardSurface } from './CardSurface';

interface BoardCardProps {
  card: Card;
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
export function BoardCard({ card, onOpen }: BoardCardProps) {
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({
    id: card.id,
    data: { type: 'card', columnId: card.column_id },
  });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className="list-none animate-fade-in"
      {...attributes}
      {...listeners}
    >
      <CardSurface
        title={card.title}
        description={card.description}
        dueDate={card.due_date}
        dimmed={isDragging}
        onClick={onOpen}
      />
    </li>
  );
}
