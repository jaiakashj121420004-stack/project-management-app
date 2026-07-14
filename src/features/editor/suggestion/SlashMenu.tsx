import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import type { SuggestionProps } from '@tiptap/suggestion';
import { cn } from '@/lib/cn';
import type { SuggestionListHandle } from './renderer';
import type { SlashItem } from './slashItems';

/**
 * The slash-command popup list. Arrow keys move the selection, Enter/Tab inserts,
 * click inserts. The parent renderer forwards key events via the imperative
 * handle. Empty query state shows every block.
 */
export const SlashMenu = forwardRef<SuggestionListHandle, SuggestionProps<SlashItem>>(
  (props, ref) => {
    const [index, setIndex] = useState(0);

    useEffect(() => setIndex(0), [props.items]);

    const select = (i: number) => {
      const item = props.items[i];
      if (item) props.command(item);
    };

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }) => {
        if (props.items.length === 0) return false;
        if (event.key === 'ArrowUp') {
          setIndex((i) => (i + props.items.length - 1) % props.items.length);
          return true;
        }
        if (event.key === 'ArrowDown') {
          setIndex((i) => (i + 1) % props.items.length);
          return true;
        }
        if (event.key === 'Enter' || event.key === 'Tab') {
          select(index);
          return true;
        }
        return false;
      },
    }));

    if (props.items.length === 0) {
      return (
        <div className="glass-menu w-64 rounded-xl border border-[var(--glass-border)] p-2 text-sm text-fg-subtle shadow-[0_18px_40px_-16px_rgba(0,0,0,0.5)]">
          No matching blocks
        </div>
      );
    }

    return (
      <div className="glass-menu max-h-72 w-64 overflow-y-auto rounded-xl border border-[var(--glass-border)] p-1 shadow-[0_18px_40px_-16px_rgba(0,0,0,0.5)]">
        {props.items.map((item, i) => {
          const Icon = item.icon;
          // A labelled divider before the first item of each new section (e.g.
          // "Your templates"). Sections group items but aren't selectable, so the
          // list stays flat and keyboard indices line up with props.items.
          const showSectionHeader =
            item.section !== undefined && item.section !== props.items[i - 1]?.section;
          return (
            <div key={item.key}>
              {showSectionHeader && (
                <p className="px-2.5 pb-1 pt-2 text-[0.7rem] font-semibold uppercase tracking-wider text-fg-subtle">
                  {item.section}
                </p>
              )}
              <button
                type="button"
                onMouseEnter={() => setIndex(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => select(i)}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors',
                  i === index ? 'bg-[var(--glass-fill)] text-fg' : 'text-fg-muted',
                )}
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-[var(--accent-from)]/10 text-[var(--accent-from)]">
                  <Icon size={16} />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-fg">{item.title}</span>
                  <span className="block truncate text-xs text-fg-subtle">{item.subtitle}</span>
                </span>
              </button>
            </div>
          );
        })}
      </div>
    );
  },
);

SlashMenu.displayName = 'SlashMenu';
