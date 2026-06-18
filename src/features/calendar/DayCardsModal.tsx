import { format } from 'date-fns';
import { Modal } from '@/components/Modal';
import type { AccentName } from '@/lib/accents';
import type { Card } from '@/types/database';
import { CardChip } from './CardChip';

interface DayCardsModalProps {
  open: boolean;
  date: Date | null;
  cards: Card[];
  accentFor: (projectId: string) => AccentName;
  onClose: () => void;
  onOpenCard: (card: Card) => void;
}

/** Shows every card on a day when its cell overflows ("+N more"). Picking one
 *  closes this and opens the full card detail modal. */
export function DayCardsModal({ open, date, cards, accentFor, onClose, onOpenCard }: DayCardsModalProps) {
  return (
    <Modal open={open} onClose={onClose} title={date ? format(date, 'EEEE, MMMM d') : undefined}>
      <div className="-mr-2 flex max-h-[60vh] flex-col gap-1.5 overflow-y-auto pr-2">
        {cards.map((card) => (
          <CardChip
            key={card.id}
            card={card}
            accent={accentFor(card.project_id)}
            onClick={() => onOpenCard(card)}
          />
        ))}
      </div>
    </Modal>
  );
}
