import { useState } from 'react';
import { motion, useAnimation, type PanInfo } from 'framer-motion';
import { Check, CheckCircle2, ChevronDown, ChevronUp, Pencil, Trash2, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Tooltip } from '@/components/Tooltip';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { TodoPriorityPicker } from './TodoPriorityPicker';
import type { TodoItem } from '@/types/database';

interface TodoItemRowProps {
  item: TodoItem;
  onToggle: (isDone: boolean) => void;
  onDelete: () => void;
  /** Save an edited item text (the pencil button next to Move up/down/Delete). */
  onEditText: (text: string) => void;
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
  onEditText,
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
  const [editingText, setEditingText] = useState(false);
  const [draft, setDraft] = useState(item.text);

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

  function startEditing() {
    setDraft(item.text);
    setEditingText(true);
  }

  function commitEdit() {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== item.text) onEditText(trimmed);
    setEditingText(false);
  }

  function cancelEdit() {
    setDraft(item.text);
    setEditingText(false);
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
        className="relative flex items-center gap-2.5 rounded-xl bg-base px-3 py-2"
      >
        {selectMode ? (
          <button
            type="button"
            role="checkbox"
            aria-checked={selected}
            aria-label={selected ? 'Deselect item' : 'Select item'}
            onClick={onToggleSelect}
            className={cn(
              'grid h-5 w-5 shrink-0 place-items-center rounded-md border-2 transition-colors',
              selected
                ? 'border-transparent bg-[linear-gradient(110deg,var(--accent-from),var(--accent-to))] text-[var(--accent-fg)]'
                : 'border-fg-subtle/55 bg-[var(--glass-fill)] text-transparent hover:border-[var(--accent-from)] hover:bg-[var(--glass-fill-strong)]',
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
              'grid h-5 w-5 shrink-0 place-items-center rounded-md border-2 transition-colors',
              item.is_done
                ? 'border-transparent bg-[linear-gradient(110deg,var(--accent-from),var(--accent-to))] text-[var(--accent-fg)]'
                : 'border-fg-subtle/55 bg-[var(--glass-fill)] text-transparent hover:border-[var(--accent-from)] hover:bg-[var(--glass-fill-strong)]',
            )}
          >
            <Check size={13} strokeWidth={3} aria-hidden />
          </button>
        )}

        {!selectMode && !editingText && (
          <TodoPriorityPicker value={item.priority} onChange={onPriorityChange} />
        )}

        {editingText ? (
          <div className="flex min-w-0 flex-1 items-center gap-1.5">
            <input
              autoFocus
              value={draft}
              maxLength={500}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  commitEdit();
                } else if (event.key === 'Escape') {
                  cancelEdit();
                }
              }}
              onBlur={commitEdit}
              aria-label="Edit to-do text"
              className="h-8 min-w-0 flex-1 rounded-lg border bg-[var(--field-bg)] px-2.5 text-sm text-fg focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--accent-from)]"
            />
            {/* onMouseDown (not onClick) so these fire before the input's onBlur
                would otherwise swallow the click and commit/cancel from under it. */}
            <Tooltip label="Save">
              <button
                type="button"
                aria-label="Save text"
                onMouseDown={(event) => {
                  event.preventDefault();
                  commitEdit();
                }}
                className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-[var(--accent-from)] hover:bg-[var(--glass-fill)]"
              >
                <Check size={15} />
              </button>
            </Tooltip>
            <Tooltip label="Cancel">
              <button
                type="button"
                aria-label="Cancel edit"
                onMouseDown={(event) => {
                  event.preventDefault();
                  cancelEdit();
                }}
                className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-fg-subtle hover:bg-[var(--glass-fill)]"
              >
                <X size={15} />
              </button>
            </Tooltip>
          </div>
        ) : (
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
        )}

        {!selectMode && !editingText && (
          <div className="flex shrink-0 items-center opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
            <Tooltip label="Edit">
              <button
                type="button"
                aria-label="Edit text"
                onClick={startEditing}
                className="grid h-7 w-6 place-items-center rounded-lg text-fg-subtle transition-colors hover:bg-[var(--glass-fill)] hover:text-fg"
              >
                <Pencil size={13} />
              </button>
            </Tooltip>
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
