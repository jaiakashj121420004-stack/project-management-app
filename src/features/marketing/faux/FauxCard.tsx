import { CardSurface } from '@/features/board/CardSurface';
import { Avatar } from '@/components/Avatar';
import type { SampleCard } from '../sampleData';
import { isoFromOffset } from '../dueDate';

/**
 * A faux Kanban card built on the REAL `CardSurface`, so it carries the same
 * glass, label pills, urgency-colored due pill and checklist tally as the live
 * app. The assignee avatar is overlaid in the corner (the real card surfaces it
 * elsewhere) to make the preview feel populated.
 */
export function FauxCard({ card }: { card: SampleCard }) {
  return (
    <div className="relative">
      <CardSurface
        title={card.title}
        labels={card.labels}
        dueDate={card.dueInDays === undefined ? null : isoFromOffset(card.dueInDays)}
        priority={card.priority ?? null}
        checklist={card.checklist ?? null}
      />
      {card.assignee && (
        <Avatar name={card.assignee} size={26} className="absolute right-3 top-3 ring-2 ring-base" />
      )}
    </div>
  );
}
