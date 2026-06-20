import { Check, Trash2 } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { TodoItem } from '@/types/database';

interface TodoItemRowProps {
  item: TodoItem;
  onToggle: (isDone: boolean) => void;
  onDelete: () => void;
}

/** One to-do: a tick box, the text (struck through when done), and a delete. */
export function TodoItemRow({ item, onToggle, onDelete }: TodoItemRowProps) {
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
            ? 'border-transparent bg-[linear-gradient(110deg,var(--accent-from),var(--accent-to))] text-white'
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

      <button
        type="button"
        aria-label="Delete item"
        onClick={onDelete}
        className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-fg-subtle opacity-0 transition-all hover:bg-danger/10 hover:text-danger focus-visible:opacity-100 group-hover:opacity-100"
      >
        <Trash2 size={13} />
      </button>
    </li>
  );
}
