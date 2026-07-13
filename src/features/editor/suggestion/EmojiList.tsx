import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import type { SuggestionProps } from '@tiptap/suggestion';
import { cn } from '@/lib/cn';
import type { SuggestionListHandle } from './renderer';
import type { EmojiChoice } from './EmojiCommand';

/** The `:shortcode` emoji autocomplete popup. Arrow keys navigate, Enter inserts. */
export const EmojiList = forwardRef<SuggestionListHandle, SuggestionProps<EmojiChoice>>(
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
        <div className="glass-menu w-56 rounded-xl border border-[var(--glass-border)] p-2 text-sm text-fg-subtle shadow-[0_18px_40px_-16px_rgba(0,0,0,0.5)]">
          No emoji found
        </div>
      );
    }

    return (
      <div className="glass-menu max-h-64 w-56 overflow-y-auto rounded-xl border border-[var(--glass-border)] p-1 shadow-[0_18px_40px_-16px_rgba(0,0,0,0.5)]">
        {props.items.map((item, i) => (
          <button
            key={`${item.shortcode}:${item.name}`}
            type="button"
            onMouseEnter={() => setIndex(i)}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => select(i)}
            className={cn(
              'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left transition-colors',
              i === index ? 'bg-[var(--glass-fill)] text-fg' : 'text-fg-muted',
            )}
          >
            <span className="text-lg leading-none">{item.emoji}</span>
            <span className="truncate text-sm">:{item.shortcode}:</span>
          </button>
        ))}
      </div>
    );
  },
);

EmojiList.displayName = 'EmojiList';
