import { useState } from 'react';
import { motion, useAnimation, type PanInfo } from 'framer-motion';
import { Check, CheckCircle2, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Tooltip } from '@/components/Tooltip';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { TodoPriorityPicker } from './TodoPriorityPicker';
import type { TodoItem } from '@/types/database';

interface TodoItemRowProps {
  item: TodoItem;
  onToggle: (isDone: boolean) => void;
  onDelete: () => void;
  onPriorityChange: (priority: number | null) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  /** Bulk-select mode (TodoListCard's "Select" toggle) — replaces the done
   *  checkbox with a selection checkbox and hides the per-row actions. */
  selectMode?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
}

const SWIPE_THRESHOLD = 72;

/**
 * One to-do: a tick box, a priority flag (P1 first — see TodoListCard's sort),
 * the text (struck through when done), reorder (up/down) controls, and a
 * delete. The reorder buttons disable at the top/bottom of their priority tier
 * (priority always outranks manual order, so a cross-tier swap would silently
 * do nothing — see `canReorder` in TodoListCard).
 *
 * On touch devices (outside select mode) the row is also swipeable: right to
 * toggle done, left to delete — the native-feeling alternative to hunting for
 * the small action buttons on a phone.
 */
export function TodoItemRow({
  item,
  onToggle,
  onDelete,
  onPriorityChange,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
  selectMode = false,
  selected = false,
  onToggleSelect,
}: TodoItemRowProps) {
  const isTouch = useMediaQuery('(pointer: coarse)');
  const controls = useAnimation();
  const [dragX, setDragX] = useState(0);

  function handleDragEnd(_e: unknown, info: PanInfo) {
    const offset = info.offset.x;
    if (offset > SWIPE_THRESHOLD) {
      onToggle(!item.is_done);
    } else if (offset < -SWIPE_THRESHOLD) {
      onDelete();
      return; // row is gone — no need to spring back
    }
    void controls.start({ x: 0 });
    setDragX(0);
  }

  return (
    <li className="group relative overflow-hidden rounded-xl">
      {isTouch && !selectMode && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-between px-4">
          <span className={cn('flex items-center gap-1.5 text-success transition-opacity', dragX > 24 ? 'opacity-100' : 'opacity-0')}>
            <CheckCircle2 size={16} /> {item.is_done ? 'Undo' : 'Done'}
          </span>
          <span className={cn('flex items-center gap-1.5 text-danger transition-opacity', dragX < -24 ? 'opacity-100' : 'opacity-0')}>
            Delete <Trash2 size={16} />
          </span>
        </div>
      )}

      <motion.div
        drag={isTouch && !selectMode ? 'x' : false}
        dragConstraints={{ left: -120, right: 120 }}
        dragElastic={0.35}
        animate={controls}
        onDrag={(_e, info) => setDragX(info.offset.x)}
        onDragEnd={handleDragEnd}
        className="relative flex items-center gap-2.5 bg-base py-0.5"
      >
        {selectMode ? (
          <button
            type="button"
            role="checkbox"
            aria-checked={selected}
            aria-label={selected ? 'Deselect item' : 'Select item'}
            onClick={onToggleSelect}
            className={cn(
              'grid h-5 w-5 shrink-0 place-items-center rounded-md border transition-colors',
              selected
                ? 'border-transparent bg-[linear-gradient(110deg,var(--accent-from),var(--accent-to))] text-[var(--accent-fg)]'
                : 'border-[var(--glass-border)] text-transparent hover:border-[var(--accent-from)]',
            )}
          >
            <Check size={13} strokeWidth={3} aria-hidden />
          </button>
        ) : (
          <button
            type="button"
            role="checkbox"
            aria-checked={item.is_done}
            aria-label={item.is_done ? 'Mark not done' : 'Mark done'}
            onClick={() => onToggle(!item.is_done)}
            className={cn(
              'grid h-5 w-5 shrink-0 place-items-center rounded-md border transition-colors',
              item.is_done
                ? 'border-transparent bg-[linear-gradient(110deg,var(--accent-from),var(--accent-to))] text-[var(--accent-fg)]'
                : 'border-[var(--glass-border)] text-transparent hover:border-[var(--accent-from)]',
            )}
          >
            <Check size={13} strokeWidth={3} aria-hidden />
          </button>
        )}

        {!selectMode && <TodoPriorityPicker value={item.priority} onChange={onPriorityChange} />}

        <span
          onClick={selectMode ? onToggleSelect : undefined}
          className={cn(
            'min-w-0 flex-1 break-words text-sm',
            selectMode && 'cursor-pointer',
            item.is_done ? 'text-fg-subtle line-through' : 'text-fg',
          )}
        >
          {item.text}
        </span>

        {!selectMode && (
          <div className="flex shrink-0 items-center opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
            <Tooltip label="Move up">
              <button
                type="button"
                aria-label="Move up"
                disabled={!canMoveUp}
                onClick={onMoveUp}
                className="grid h-7 w-6 place-items-center rounded-lg text-fg-subtle transition-colors hover:bg-[var(--glass-fill)] hover:text-fg disabled:pointer-events-none disabled:opacity-30"
              >
                <ChevronUp size={14} />
              </button>
            </Tooltip>
            <Tooltip label="Move down">
              <button
                type="button"
                aria-label="Move down"
                disabled={!canMoveDown}
                onClick={onMoveDown}
                className="grid h-7 w-6 place-items-center rounded-lg text-fg-subtle transition-colors hover:bg-[var(--glass-fill)] hover:text-fg disabled:pointer-events-none disabled:opacity-30"
              >
                <ChevronDown size={14} />
              </button>
            </Tooltip>
            <Tooltip label="Delete">
              <button
                type="button"
                aria-label="Delete item"
                onClick={onDelete}
                className="grid h-7 w-7 place-items-center rounded-lg text-fg-subtle transition-colors hover:bg-danger/10 hover:text-danger"
              >
                <Trash2 size={13} />
              </button>
            </Tooltip>
          </div>
        )}
      </motion.div>
    </li>
  );
}
