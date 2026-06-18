import { useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Check, GripVertical, Pencil, Plus, Trash2, X } from 'lucide-react';
import { GlassPanel } from '@/components/glass/GlassPanel';
import { cn } from '@/lib/cn';
import type { Card, Column } from '@/types/database';
import { BoardCard } from './BoardCard';
import { columnNameSchema, cardTitleSchema } from './schemas';

interface BoardColumnProps {
  column: Column;
  cards: Card[];
  onRename: (columnId: string, name: string) => void;
  onDelete: (column: Column) => void;
  onAddCard: (columnId: string, title: string) => void;
  onOpenCard: (card: Card) => void;
}

/**
 * One Kanban column: a glass panel with a draggable header (grip), inline
 * rename, a delete action, a sortable list of cards, and a quick-add composer.
 * The column itself is sortable (reorder columns) while its cards live in a
 * nested vertical SortableContext.
 */
export function BoardColumn({
  column,
  cards,
  onRename,
  onDelete,
  onAddCard,
  onOpenCard,
}: BoardColumnProps) {
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({
    id: column.id,
    data: { type: 'column' },
  });

  const [renaming, setRenaming] = useState(false);

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className="w-[19rem] shrink-0 animate-fade-in"
    >
      <GlassPanel
        strong
        className={cn('flex max-h-full flex-col gap-3 p-3 transition-opacity', isDragging && 'opacity-40')}
      >
        <header className="flex items-center gap-1.5">
          <button
            type="button"
            aria-label={`Reorder ${column.name}`}
            className="grid h-7 w-7 shrink-0 cursor-grab touch-none place-items-center rounded-lg text-fg-subtle transition-colors hover:bg-[var(--glass-fill)] hover:text-fg active:cursor-grabbing"
            {...attributes}
            {...listeners}
          >
            <GripVertical size={16} />
          </button>

          {renaming ? (
            <ColumnNameEditor
              initial={column.name}
              onCancel={() => setRenaming(false)}
              onSave={(name) => {
                onRename(column.id, name);
                setRenaming(false);
              }}
            />
          ) : (
            <>
              <h3 className="min-w-0 flex-1 truncate font-display font-semibold text-fg">
                {column.name}
              </h3>
              <span className="grid h-6 min-w-6 place-items-center rounded-full bg-[var(--glass-fill)] px-1.5 text-xs font-medium text-fg-muted">
                {cards.length}
              </span>
              <div className="flex items-center">
                <HeaderAction label={`Rename ${column.name}`} onClick={() => setRenaming(true)}>
                  <Pencil size={14} />
                </HeaderAction>
                <HeaderAction label={`Delete ${column.name}`} onClick={() => onDelete(column)}>
                  <Trash2 size={14} />
                </HeaderAction>
              </div>
            </>
          )}
        </header>

        <SortableContext items={cards.map((card) => card.id)} strategy={verticalListSortingStrategy}>
          <ul className="flex min-h-[0.5rem] flex-col gap-2.5 overflow-y-auto">
            {cards.map((card) => (
              <BoardCard key={card.id} card={card} onOpen={() => onOpenCard(card)} />
            ))}
          </ul>
        </SortableContext>

        <CardComposer onAdd={(title) => onAddCard(column.id, title)} />
      </GlassPanel>
    </div>
  );
}

/** Header icon button that doesn't trigger the column drag. */
function HeaderAction({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="grid h-7 w-7 place-items-center rounded-lg text-fg-subtle opacity-70 transition-colors hover:bg-[var(--glass-fill)] hover:text-fg hover:opacity-100"
    >
      {children}
    </button>
  );
}

/** Inline column rename: Enter / ✓ saves, Esc / ✕ cancels, blur saves. */
function ColumnNameEditor({
  initial,
  onSave,
  onCancel,
}: {
  initial: string;
  onSave: (name: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initial);

  function commit() {
    const parsed = columnNameSchema.safeParse(value);
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
    <div className="flex flex-1 items-center gap-1.5">
      <input
        autoFocus
        value={value}
        maxLength={60}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={commit}
        aria-label="Column name"
        className="h-8 w-full rounded-lg border bg-[var(--field-bg)] px-2.5 text-sm font-semibold text-fg focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--accent-from)]"
      />
      <button
        type="button"
        aria-label="Save column name"
        onMouseDown={(event) => event.preventDefault()}
        onClick={commit}
        className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-success hover:bg-[var(--glass-fill)]"
      >
        <Check size={15} />
      </button>
      <button
        type="button"
        aria-label="Cancel rename"
        onMouseDown={(event) => event.preventDefault()}
        onClick={onCancel}
        className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-fg-subtle hover:bg-[var(--glass-fill)] hover:text-fg"
      >
        <X size={15} />
      </button>
    </div>
  );
}

/** Quick-add a card to the bottom of the column. */
function CardComposer({ onAdd }: { onAdd: (title: string) => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);

  function close() {
    setOpen(false);
    setTitle('');
    setError(null);
  }

  function submit() {
    const parsed = cardTitleSchema.safeParse(title);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Invalid title.');
      return;
    }
    onAdd(parsed.data);
    // Keep the composer open so several cards can be added in a row.
    setTitle('');
    setError(null);
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    submit();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submit();
    } else if (event.key === 'Escape') {
      close();
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-xl px-2 py-1.5 text-sm font-medium text-fg-muted transition-colors hover:bg-[var(--glass-fill)] hover:text-fg"
      >
        <Plus size={16} /> Add a card
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <textarea
        autoFocus
        value={title}
        maxLength={200}
        placeholder="What needs doing?"
        onChange={(event) => setTitle(event.target.value)}
        onKeyDown={handleKeyDown}
        aria-label="Card title"
        className="min-h-[60px] w-full resize-none rounded-xl border bg-[var(--field-bg)] px-3 py-2 text-sm text-fg placeholder:text-fg-subtle focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--accent-from)]"
      />
      {error && <p className="text-xs text-danger">{error}</p>}
      <div className="flex items-center gap-2">
        <button
          type="submit"
          className="btn-3d inline-flex h-8 items-center gap-1.5 rounded-xl bg-[linear-gradient(110deg,var(--accent-from),var(--accent-to))] px-3 text-sm font-medium text-white"
        >
          <Plus size={15} /> Add card
        </button>
        <button
          type="button"
          onClick={close}
          aria-label="Close composer"
          className="grid h-8 w-8 place-items-center rounded-xl text-fg-subtle hover:bg-[var(--glass-fill)] hover:text-fg"
        >
          <X size={16} />
        </button>
      </div>
    </form>
  );
}
