import { Check, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { TodoItem } from '@/types/database';

interface TodoItemRowProps {
  item: TodoItem;
  onToggle: (isDone: boolean) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}

/**
 * One to-do: a tick box, the text (struck through when done), reorder
 * (up/down) controls, and a delete. The reorder buttons disable at the
 * top/bottom of the list.
 */
export function TodoItemRow({
  item,
  onToggle,
  onDelete,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
}: TodoItemRowProps) {
  return (
    <li className="group flex items-center gap-2.5">
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

      <span
        className={cn(
          'min-w-0 flex-1 break-words text-sm',
          item.is_done ? 'text-fg-subtle line-through' : 'text-fg',
        )}
      >
        {item.text}
      </span>

      <div className="flex shrink-0 items-center opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
        <button
          type="button"
          aria-label="Move up"
          title="Move up"
          disabled={!canMoveUp}
          onClick={onMoveUp}
          className="grid h-7 w-6 place-items-center rounded-lg text-fg-subtle transition-colors hover:bg-[var(--glass-fill)] hover:text-fg disabled:pointer-events-none disabled:opacity-30"
        >
          <ChevronUp size={14} />
        </button>
        <button
          type="button"
          aria-label="Move down"
          title="Move down"
          disabled={!canMoveDown}
          onClick={onMoveDown}
          className="grid h-7 w-6 place-items-center rounded-lg text-fg-subtle transition-colors hover:bg-[var(--glass-fill)] hover:text-fg disabled:pointer-events-none disabled:opacity-30"
        >
          <ChevronDown size={14} />
        </button>
        <button
          type="button"
          aria-label="Delete item"
          onClick={onDelete}
          className="grid h-7 w-7 place-items-center rounded-lg text-fg-subtle transition-colors hover:bg-danger/10 hover:text-danger"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </li>
  );
}
