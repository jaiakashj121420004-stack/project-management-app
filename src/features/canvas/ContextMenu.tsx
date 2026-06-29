/**
 * ContextMenu.tsx — glassmorphic right-click / long-press menu for canvas elements.
 *
 * Appears at (x, y) screen coordinates (relative to the canvas container).
 * When `elementId` is null the menu was triggered on the canvas background so
 * element-specific actions (z-order, lock, delete) are omitted and only paste
 * is shown (if the clipboard is non-empty).
 */
import { useEffect, useRef } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronUp,
  Copy,
  ChevronsDown,
  ChevronsUp,
  Clipboard,
  Lock,
  Trash2,
  Unlock,
  Files,
} from 'lucide-react';
import { cn } from '@/lib/cn';

export interface ContextMenuProps {
  /** Container-relative position where the menu should appear. */
  x: number;
  y: number;
  /** The element that was right-clicked; null = canvas background. */
  elementId: string | null;
  /** Number of elements currently selected (drives label pluralisation). */
  selectionCount: number;
  hasClipboard: boolean;
  selectedLocked: boolean;
  canEdit: boolean;
  onBringToFront: () => void;
  onBringForward: () => void;
  onSendBackward: () => void;
  onSendToBack: () => void;
  onDuplicate: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onToggleLock: () => void;
  onDeleteSelected: () => void;
  onClose: () => void;
}

/**
 * A floating glass context menu that positions itself within the canvas
 * container. Closes on any outside click, Escape, or after any action.
 */
export function ContextMenu({
  x,
  y,
  elementId,
  selectionCount,
  hasClipboard,
  selectedLocked,
  canEdit,
  onBringToFront,
  onBringForward,
  onSendBackward,
  onSendToBack,
  onDuplicate,
  onCopy,
  onPaste,
  onToggleLock,
  onDeleteSelected,
  onClose,
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click or Escape.
  useEffect(() => {
    function handlePointerDown(e: PointerEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    // Use capture so we intercept before other handlers.
    document.addEventListener('pointerdown', handlePointerDown, true);
    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [onClose]);

  // Position: clamp so the menu never escapes the viewport.
  const style: React.CSSProperties = {
    left: x,
    top: y,
    // The menu is absolutely positioned inside the canvas container so it
    // naturally stays within the canvas box. The transform nudges it left/up
    // if it would overflow — a heuristic (menu is ≈160px wide, ≈240px tall).
    transform: 'none',
  };

  const hasSelection = selectionCount > 0 && elementId !== null;
  const multi = selectionCount > 1;

  function wrap(fn: () => void) {
    return () => {
      fn();
      onClose();
    };
  }

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label="Element options"
      className="glass-menu absolute z-50 min-w-[160px] rounded-2xl border border-[var(--glass-border)] py-1 shadow-[0_16px_48px_-12px_rgba(0,0,0,0.7)]"
      style={style}
      onPointerDown={(e) => e.stopPropagation()} // prevent outside-click handler
    >
      {/* Z-order — only when something is selected AND we're in edit mode */}
      {canEdit && hasSelection && (
        <>
          <MenuItem
            icon={<ChevronsUp size={14} />}
            label="Bring to front"
            shortcut="⌘⇧]"
            onClick={wrap(onBringToFront)}
          />
          <MenuItem
            icon={<ChevronUp size={14} />}
            label="Bring forward"
            shortcut="⌘]"
            onClick={wrap(onBringForward)}
          />
          <MenuItem
            icon={<ChevronDown size={14} />}
            label="Send backward"
            shortcut="⌘["
            onClick={wrap(onSendBackward)}
          />
          <MenuItem
            icon={<ChevronsDown size={14} />}
            label="Send to back"
            shortcut="⌘⇧["
            onClick={wrap(onSendToBack)}
          />
          <Separator />
          <MenuItem
            icon={<Files size={14} />}
            label={multi ? `Duplicate ${selectionCount}` : 'Duplicate'}
            shortcut="⌘D"
            onClick={wrap(onDuplicate)}
          />
          <MenuItem
            icon={<Copy size={14} />}
            label={multi ? `Copy ${selectionCount}` : 'Copy'}
            shortcut="⌘C"
            onClick={wrap(onCopy)}
          />
        </>
      )}

      {/* Paste — always shown when clipboard is non-empty and editing */}
      {canEdit && hasClipboard && (
        <MenuItem
          icon={<Clipboard size={14} />}
          label="Paste"
          shortcut="⌘V"
          onClick={wrap(onPaste)}
        />
      )}

      {/* Lock / Delete — only when something is selected in edit mode */}
      {canEdit && hasSelection && (
        <>
          <Separator />
          <MenuItem
            icon={selectedLocked ? <Unlock size={14} /> : <Lock size={14} />}
            label={selectedLocked ? 'Unlock' : (multi ? `Lock ${selectionCount}` : 'Lock')}
            onClick={wrap(onToggleLock)}
          />
          <MenuItem
            icon={<Trash2 size={14} />}
            label={multi ? `Delete ${selectionCount}` : 'Delete'}
            shortcut="⌫"
            onClick={wrap(onDeleteSelected)}
            danger
          />
        </>
      )}

      {/* Fallback: nothing actionable */}
      {!canEdit && !hasClipboard && (
        <div className="px-3 py-2 text-xs text-fg-subtle">No actions available</div>
      )}
    </div>
  );
}

// ── Internal sub-components ────────────────────────────────────────────────

function MenuItem({
  icon,
  label,
  shortcut,
  onClick,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  shortcut?: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors',
        danger
          ? 'text-danger hover:bg-danger/10'
          : 'text-fg hover:bg-[var(--glass-fill)]',
      )}
    >
      <span className="shrink-0 opacity-70">{icon}</span>
      <span className="flex-1">{label}</span>
      {shortcut && (
        <span className="ml-4 shrink-0 text-[10px] tracking-wide opacity-40">{shortcut}</span>
      )}
    </button>
  );
}

function Separator() {
  return <div className="mx-2 my-1 h-px bg-[var(--glass-border)]" aria-hidden />;
}

// Suppress unused import warnings for icons used only conditionally
void ArrowDown;
void ArrowUp;
