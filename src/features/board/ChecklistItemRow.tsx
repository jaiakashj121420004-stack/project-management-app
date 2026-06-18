import { useState, type KeyboardEvent } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Check, GripVertical, Trash2 } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { ChecklistItem } from '@/types/database';
import { checklistItemTextSchema } from './schemas';

interface ChecklistItemRowProps {
  item: ChecklistItem;
  onToggle: (isDone: boolean) => void;
  onRename: (text: string) => void;
  onDelete: () => void;
}

/** One to-do: drag grip, tick box, click-to-edit text, delete. Sortable within
 *  the checklist's own DndContext (reorder writes a fractional position). */
export function ChecklistItemRow({ item, onToggle, onRename, onDelete }: ChecklistItemRowProps) {
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({
    id: item.id,
  });
  const [editing, setEditing] = useState(false);

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'group flex items-center gap-1.5 rounded-xl px-1 py-1 transition-colors hover:bg-[var(--glass-fill)]',
        isDragging && 'opacity-50',
      )}
    >
      <button
        type="button"
        aria-label="Reorder item"
        className="grid h-6 w-5 shrink-0 cursor-grab touch-none place-items-center rounded text-fg-subtle opacity-0 transition-opacity hover:text-fg group-hover:opacity-100 active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical size={14} />
      </button>

      <button
        type="button"
        role="checkbox"
        aria-checked={item.is_done}
        aria-label={item.is_done ? `Mark "${item.text}" not done` : `Mark "${item.text}" done`}
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

      {editing ? (
        <ChecklistItemEditor
          initial={item.text}
          onCancel={() => setEditing(false)}
          onSave={(text) => {
            onRename(text);
            setEditing(false);
          }}
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className={cn(
            'min-w-0 flex-1 truncate rounded px-1 py-0.5 text-left text-sm transition-colors',
            item.is_done ? 'text-fg-subtle line-through' : 'text-fg',
          )}
        >
          {item.text}
        </button>
      )}

      <button
        type="button"
        aria-label={`Delete "${item.text}"`}
        onClick={onDelete}
        className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-fg-subtle opacity-0 transition-all hover:bg-danger/10 hover:text-danger group-hover:opacity-100"
      >
        <Trash2 size={14} />
      </button>
    </li>
  );
}

/** Inline text editor: Enter / blur saves a valid change, Esc cancels. */
function ChecklistItemEditor({
  initial,
  onSave,
  onCancel,
}: {
  initial: string;
  onSave: (text: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initial);

  function commit() {
    const parsed = checklistItemTextSchema.safeParse(value);
    if (!parsed.success || parsed.data === initial) {
      onCancel();
      return;
    }
    onSave(parsed.data);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault();
      commit();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      onCancel();
    }
  }

  return (
    <input
      autoFocus
      value={value}
      maxLength={500}
      onChange={(event) => setValue(event.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={commit}
      aria-label="Edit item"
      className="min-w-0 flex-1 rounded-lg border bg-[var(--field-bg)] px-2 py-1 text-sm text-fg focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--accent-from)]"
    />
  );
}
