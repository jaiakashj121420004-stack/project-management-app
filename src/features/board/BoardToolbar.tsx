import type { ReactNode } from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { labelHex, withAlpha } from '@/lib/labelColors';
import type { Label } from '@/types/database';

export type DueFilter = 'overdue' | 'week';
/** Review states the board can filter by (Pro collaboration). */
export type ReviewFilter = 'in_review' | 'changes_requested' | 'approved';

const REVIEW_FILTER_LABELS: Record<ReviewFilter, string> = {
  in_review: 'In review',
  changes_requested: 'Needs changes',
  approved: 'Approved',
};

interface BoardToolbarProps {
  labels: Label[];
  query: string;
  onQueryChange: (value: string) => void;
  selectedLabelIds: Set<string>;
  onToggleLabel: (id: string) => void;
  dueFilters: Set<DueFilter>;
  onToggleDue: (filter: DueFilter) => void;
  reviewFilters: Set<ReviewFilter>;
  onToggleReview: (filter: ReviewFilter) => void;
  filtering: boolean;
  onClear: () => void;
}

/** Find/filter bar above the board: title search, due-status chips, and label
 *  chips. Filtering hides non-matching cards (Board keeps them mounted so drag
 *  ordering stays correct). */
export function BoardToolbar({
  labels,
  query,
  onQueryChange,
  selectedLabelIds,
  onToggleLabel,
  dueFilters,
  onToggleDue,
  reviewFilters,
  onToggleReview,
  filtering,
  onClear,
}: BoardToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <div className="relative min-w-[12rem] flex-1 sm:max-w-xs">
        <Search
          size={16}
          aria-hidden
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-subtle"
        />
        <input
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search cards…"
          aria-label="Search cards by title"
          className="h-11 w-full rounded-2xl border bg-[var(--field-bg)] pl-10 pr-3 text-sm leading-none text-fg placeholder:text-fg-subtle backdrop-blur-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--accent-from)]"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <FilterChip active={dueFilters.has('overdue')} onClick={() => onToggleDue('overdue')}>
          Overdue
        </FilterChip>
        <FilterChip active={dueFilters.has('week')} onClick={() => onToggleDue('week')}>
          Due this week
        </FilterChip>

        {(Object.keys(REVIEW_FILTER_LABELS) as ReviewFilter[]).map((filter) => (
          <FilterChip
            key={filter}
            active={reviewFilters.has(filter)}
            onClick={() => onToggleReview(filter)}
          >
            {REVIEW_FILTER_LABELS[filter]}
          </FilterChip>
        ))}

        {labels.map((label) => {
          const active = selectedLabelIds.has(label.id);
          const hex = labelHex(label.color);
          return (
            <button
              key={label.id}
              type="button"
              aria-pressed={active}
              onClick={() => onToggleLabel(label.id)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                !active && 'border-[var(--glass-border)] text-fg-muted hover:bg-[var(--glass-fill)]',
              )}
              style={
                active
                  ? { backgroundColor: withAlpha(hex, 0.18), borderColor: withAlpha(hex, 0.4), color: hex }
                  : undefined
              }
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: hex }} aria-hidden />
              {label.name}
            </button>
          );
        })}

        {filtering && (
          <button
            type="button"
            onClick={onClear}
            className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium text-fg-muted transition-colors hover:bg-[var(--glass-fill)] hover:text-fg"
          >
            <X size={13} /> Clear
          </button>
        )}
      </div>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
        active
          ? 'border-transparent bg-[linear-gradient(110deg,var(--accent-from),var(--accent-to))] text-white'
          : 'border-[var(--glass-border)] text-fg-muted hover:bg-[var(--glass-fill)] hover:text-fg',
      )}
    >
      {children}
    </button>
  );
}
