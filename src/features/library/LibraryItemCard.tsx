import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import {
  FolderIcon,
  FileText,
  Shapes,
  MoreVertical,
  FolderInput,
  Pencil,
  Trash2,
  type LucideIcon,
} from 'lucide-react';
import { GlassPanel } from '@/components/glass/GlassPanel';
import { cn } from '@/lib/cn';
import { itemLabel, type LibraryItem } from './types';

interface LibraryItemCardProps {
  item: LibraryItem;
  /** Editor gate — hides rename/move/delete for read-only viewers. */
  canEdit: boolean;
  onOpen: () => void;
  onRename: () => void;
  onMove: () => void;
  onDelete: () => void;
}

const ICONS: Record<LibraryItem['kind'], LucideIcon> = {
  folder: FolderIcon,
  note: FileText,
  canvas: Shapes,
};

/** How long a touch must be held (ms) to open the context menu. */
const LONG_PRESS_MS = 500;

/**
 * A single Library tile. Click opens it (folder → navigate in, note/canvas →
 * editor). A kebab button, right-click, and touch long-press all open the same
 * action menu (Rename / Move / Delete). The menu closes on outside-tap or Escape.
 */
export function LibraryItemCard({
  item,
  canEdit,
  onOpen,
  onRename,
  onMove,
  onDelete,
}: LibraryItemCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const longPressTimer = useRef<number | null>(null);
  const longPressed = useRef(false);

  const Icon = ICONS[item.kind];
  const label = itemLabel(item);
  const emoji = item.kind !== 'canvas' ? item.icon : null;
  const subtitle = item.kind === 'folder' ? 'Folder' : item.subtitle;

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event: globalThis.PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setMenuOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

  function clearLongPress() {
    if (longPressTimer.current !== null) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (!canEdit || event.pointerType === 'mouse') return;
    longPressed.current = false;
    longPressTimer.current = window.setTimeout(() => {
      longPressed.current = true;
      setMenuOpen(true);
    }, LONG_PRESS_MS);
  }

  function handleClick() {
    if (longPressed.current) {
      longPressed.current = false;
      return; // the long-press opened the menu; don't also open the item
    }
    onOpen();
  }

  return (
    <div ref={rootRef} className="relative">
      <GlassPanel
        role="button"
        tabIndex={0}
        onClick={handleClick}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onOpen();
          }
        }}
        onContextMenu={(event) => {
          if (!canEdit) return;
          event.preventDefault();
          setMenuOpen(true);
        }}
        onPointerDown={handlePointerDown}
        onPointerUp={clearLongPress}
        onPointerMove={clearLongPress}
        onPointerCancel={clearLongPress}
        className="group flex cursor-pointer items-center gap-3 p-4 transition-transform duration-200 ease-spring hover:-translate-y-0.5"
      >
        <span
          className={cn(
            'grid h-11 w-11 shrink-0 place-items-center rounded-xl',
            item.kind === 'folder'
              ? 'bg-[var(--accent-from)]/12 text-[var(--accent-from)]'
              : 'bg-[var(--glass-fill)] text-fg-muted',
          )}
        >
          {emoji ? <span className="text-xl leading-none">{emoji}</span> : <Icon size={20} />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-[0.98rem] font-semibold text-fg">{label}</p>
          <p className="mt-0.5 truncate text-xs text-fg-muted">{subtitle}</p>
        </div>

        {canEdit && (
          <button
            type="button"
            aria-label="Item actions"
            onClick={(event) => {
              event.stopPropagation();
              setMenuOpen((open) => !open);
            }}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-fg-subtle opacity-70 transition-colors hover:bg-[var(--glass-fill)] hover:text-fg group-hover:opacity-100"
          >
            <MoreVertical size={17} />
          </button>
        )}
      </GlassPanel>

      {menuOpen && canEdit && (
        <div
          role="menu"
          className="glass-strong absolute right-2 top-14 z-20 w-44 overflow-hidden rounded-xl p-1 shadow-[0_18px_40px_-16px_rgba(0,0,0,0.5)]"
        >
          <MenuButton icon={Pencil} label="Rename" onClick={() => run(setMenuOpen, onRename)} />
          <MenuButton icon={FolderInput} label="Move to…" onClick={() => run(setMenuOpen, onMove)} />
          <MenuButton
            icon={Trash2}
            label="Delete"
            danger
            onClick={() => run(setMenuOpen, onDelete)}
          />
        </div>
      )}
    </div>
  );
}

function run(setOpen: (open: boolean) => void, action: () => void) {
  setOpen(false);
  action();
}

function MenuButton({
  icon: Icon,
  label,
  danger = false,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors',
        danger
          ? 'text-danger hover:bg-danger/10'
          : 'text-fg-muted hover:bg-[var(--glass-fill)] hover:text-fg',
      )}
    >
      <Icon size={15} className="shrink-0" />
      {label}
    </button>
  );
}
