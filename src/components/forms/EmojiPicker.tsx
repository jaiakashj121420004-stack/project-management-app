import { useState } from 'react';
import { SmilePlus } from 'lucide-react';
import { ToolbarPopover } from './ToolbarPopover';
import { cn } from '@/lib/cn';

/** A curated set of icons well-suited to notes + folders (the `:` autocomplete
 *  in the editor covers the long tail; this is a fast one-tap grid). */
const ICON_EMOJIS: readonly string[] = [
  '📝', '📄', '📌', '📎', '🗂️', '📁', '📅', '🗓️',
  '✅', '⭐', '🔥', '💡', '🎯', '🚀', '📊', '📈',
  '💰', '🧠', '❤️', '⚡', '🌟', '🎨', '🎵', '📷',
  '🎬', '🏠', '💼', '🛠️', '🔬', '📚', '✏️', '🔖',
  '🌱', '🌍', '☕', '🍀', '🎉', '🥳', '🤔', '💯',
];

/**
 * A self-contained emoji picker for a note/folder icon. Shows the current icon
 * (or a "+smiley" affordance) and opens a portaled popover — viewport-safe on
 * mobile — with a quick grid plus a Remove option. Pass `null` to onSelect to
 * clear the icon.
 */
export function EmojiPicker({
  value,
  onSelect,
  ariaLabel = 'Set icon',
  buttonClassName,
  iconSize = 18,
}: {
  value: string | null;
  onSelect: (emoji: string | null) => void;
  ariaLabel?: string;
  buttonClassName?: string;
  iconSize?: number;
}) {
  const [open, setOpen] = useState(false);

  return (
    <ToolbarPopover
      open={open}
      onClose={() => setOpen(false)}
      title="Choose an icon"
      trigger={
        <button
          type="button"
          aria-label={ariaLabel}
          title={ariaLabel}
          onClick={() => setOpen((o) => !o)}
          className={cn(
            'grid place-items-center rounded-lg leading-none transition-colors hover:bg-[var(--glass-fill)]',
            buttonClassName,
          )}
        >
          {value ? (
            <span style={{ fontSize: iconSize }}>{value}</span>
          ) : (
            <SmilePlus size={iconSize} className="text-fg-subtle" />
          )}
        </button>
      }
    >
      <div className="grid w-60 grid-cols-8 gap-0.5">
        {ICON_EMOJIS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            aria-label={`Icon ${emoji}`}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              onSelect(emoji);
              setOpen(false);
            }}
            className={cn(
              'grid h-7 w-7 place-items-center rounded-md text-lg transition-colors hover:bg-[var(--glass-fill)]',
              value === emoji && 'bg-[var(--accent-from)]/20',
            )}
          >
            {emoji}
          </button>
        ))}
      </div>
      {value && (
        <button
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            onSelect(null);
            setOpen(false);
          }}
          className="mt-2 w-full rounded-lg px-2 py-1 text-xs text-fg-muted transition-colors hover:bg-[var(--glass-fill)] hover:text-fg"
        >
          Remove icon
        </button>
      )}
    </ToolbarPopover>
  );
}
