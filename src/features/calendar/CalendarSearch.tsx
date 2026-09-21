import { useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Search, X } from 'lucide-react';
import { ToolbarPopover } from '@/components/forms/ToolbarPopover';
import { accentVars, type AccentName } from '@/lib/accents';
import { formatDueTime } from '@/lib/dueAt';
import type { Card } from '@/types/database';

interface CalendarSearchProps {
  /** Search runs over whatever the toolbar's project filter currently shows. */
  cards: Card[];
  accentFor: (projectId: string) => AccentName;
  onSelect: (card: Card) => void;
}

const MAX_RESULTS = 8;

/** Find a card by title without paging through months — matches as you type,
 *  picking a result jumps the Calendar straight to that card's day. */
export function CalendarSearch({ cards, accentFor, onSelect }: CalendarSearchProps) {
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return cards
      .filter((card) => card.title.toLowerCase().includes(q))
      .sort((a, b) => (a.due_date ?? '').localeCompare(b.due_date ?? ''))
      .slice(0, MAX_RESULTS);
  }, [cards, query]);

  const open = focused && query.trim().length > 0;

  function handleSelect(card: Card) {
    onSelect(card);
    setQuery('');
    setFocused(false);
  }

  return (
    <ToolbarPopover
      open={open}
      onClose={() => setFocused(false)}
      title="Matching cards"
      trigger={
        <div className="glass flex h-9 items-center gap-1.5 rounded-xl px-2.5">
          <Search size={14} className="shrink-0 text-fg-subtle" aria-hidden />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onFocus={() => setFocused(true)}
            placeholder="Search cards"
            aria-label="Search cards"
            className="w-28 bg-transparent text-sm text-fg placeholder:text-fg-subtle focus:outline-none sm:w-36"
          />
          {query && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setQuery('')}
              className="shrink-0 text-fg-subtle transition-colors hover:text-fg"
            >
              <X size={13} />
            </button>
          )}
        </div>
      }
    >
      <div className="flex flex-col gap-0.5">
        {results.length === 0 ? (
          <p className="px-2 py-1.5 text-sm text-fg-muted">No cards match &ldquo;{query.trim()}&rdquo;.</p>
        ) : (
          results.map((card) => (
            <button
              key={card.id}
              type="button"
              style={accentVars(accentFor(card.project_id))}
              onClick={() => handleSelect(card)}
              className="flex items-center gap-2 rounded-xl px-2 py-1.5 text-left text-sm transition-colors hover:bg-[var(--glass-fill)]"
            >
              <span
                aria-hidden
                className="h-3.5 w-1 shrink-0 rounded-full bg-[linear-gradient(180deg,var(--accent-from),var(--accent-to))]"
              />
              <span className="min-w-0 flex-1 truncate text-fg">{card.title}</span>
              <span className="shrink-0 text-xs text-fg-subtle">
                {card.due_date ? format(parseISO(card.due_date), 'MMM d') : ''}
                {card.due_at ? ` · ${formatDueTime(card.due_at)}` : ''}
              </span>
            </button>
          ))
        )}
      </div>
    </ToolbarPopover>
  );
}
