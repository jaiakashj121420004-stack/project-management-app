import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { SmilePlus } from 'lucide-react';
import { cn } from '@/lib/cn';
import { springs } from '@/lib/motion';
import { useAuth } from '@/hooks/useAuth';
import type { Reaction, ReactionTarget } from '@/types/database';
import { useAddReaction, useReactions, useRemoveReaction } from './useReactions';

const PALETTE = ['👍', '❤️', '🎉', '🚀', '👀', '😄', '🙌', '✅'] as const;

interface ReactionBarProps {
  targetType: ReactionTarget;
  targetId: string;
  /** Whether the viewer may add reactions (Pro board + member). */
  canReact: boolean;
}

/** Grouped emoji reactions with an add-popover. Toggling is optimistic. */
export function ReactionBar({ targetType, targetId, canReact }: ReactionBarProps) {
  const { user } = useAuth();
  const { data: reactions = [] } = useReactions(targetType, targetId);
  const add = useAddReaction(targetType, targetId);
  const remove = useRemoveReaction(targetType, targetId);
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!pickerOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) setPickerOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPickerOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [pickerOpen]);

  // Group by emoji, preserving first-seen order.
  const groups: { emoji: string; list: Reaction[] }[] = [];
  for (const reaction of reactions) {
    const existing = groups.find((group) => group.emoji === reaction.emoji);
    if (existing) existing.list.push(reaction);
    else groups.push({ emoji: reaction.emoji, list: [reaction] });
  }

  const toggle = (emoji: string) => {
    if (!user || !canReact) return;
    const mine = reactions.find((r) => r.emoji === emoji && r.user_id === user.id);
    if (mine) remove.mutate({ id: mine.id });
    else add.mutate({ emoji, userId: user.id, tempId: crypto.randomUUID() });
  };

  if (groups.length === 0 && !canReact) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {groups.map((group) => {
        const mine = Boolean(user && group.list.some((r) => r.user_id === user.id));
        return (
          <button
            key={group.emoji}
            type="button"
            disabled={!canReact}
            onClick={() => toggle(group.emoji)}
            className={cn(
              'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium transition-colors',
              mine
                ? 'border-[var(--accent-from)]/40 bg-[var(--accent-from)]/15 text-fg'
                : 'border-[var(--glass-border)] bg-[var(--glass-fill)] text-fg-muted hover:text-fg',
              !canReact && 'cursor-default',
            )}
            aria-pressed={mine}
          >
            <span aria-hidden>{group.emoji}</span>
            {group.list.length}
          </button>
        );
      })}

      {canReact && (
        <div ref={pickerRef} className="relative">
          <button
            type="button"
            onClick={() => setPickerOpen((value) => !value)}
            aria-label="Add reaction"
            aria-haspopup="menu"
            aria-expanded={pickerOpen}
            className="grid h-6 w-6 place-items-center rounded-full border border-[var(--glass-border)] text-fg-subtle transition-colors hover:text-fg"
          >
            <SmilePlus size={13} />
          </button>
          <AnimatePresence>
            {pickerOpen && (
              <motion.div
                role="menu"
                initial={{ opacity: 0, scale: 0.95, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -4 }}
                transition={springs.snappy}
                className="glass-menu absolute left-0 top-8 z-50 flex w-max max-w-[12rem] flex-wrap gap-1 rounded-2xl p-2"
              >
                {PALETTE.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      toggle(emoji);
                      setPickerOpen(false);
                    }}
                    className="grid h-8 w-8 place-items-center rounded-xl text-lg transition-colors hover:bg-[var(--glass-fill)]"
                  >
                    {emoji}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
