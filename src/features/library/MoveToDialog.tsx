import { useMemo } from 'react';
import { FolderIcon, Home, Check } from 'lucide-react';
import { Modal } from '@/components/Modal';
import { cn } from '@/lib/cn';
import type { Folder } from '@/types/database';
import { buildFolderTree, type FolderNode } from './tree';

interface MoveToDialogProps {
  open: boolean;
  folders: Folder[];
  /** The item's current folder (shows a check; selecting it is a no-op). */
  currentFolderId: string | null;
  /** Destinations to disable (a folder can't move into itself/its subtree). */
  disabledIds?: Set<string>;
  onClose: () => void;
  onMove: (folderId: string | null) => void;
}

interface FlatRow {
  folder: Folder;
  depth: number;
}

/** Depth-first flatten of the tree so the picker shows the hierarchy indented. */
function flatten(nodes: FolderNode[], depth = 0, acc: FlatRow[] = []): FlatRow[] {
  for (const node of nodes) {
    acc.push({ folder: node, depth });
    flatten(node.children, depth + 1, acc);
  }
  return acc;
}

/** A modal folder picker for "Move to…". Lists the Library root plus every folder
 *  indented by depth; the current location is checked and invalid targets are
 *  disabled. Works identically on desktop and touch (the Phase 2 move path). */
export function MoveToDialog({
  open,
  folders,
  currentFolderId,
  disabledIds,
  onClose,
  onMove,
}: MoveToDialogProps) {
  const rows = useMemo(() => flatten(buildFolderTree(folders)), [folders]);

  function choose(folderId: string | null) {
    if (folderId !== currentFolderId) onMove(folderId);
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="Move to…" className="max-w-md">
      <div className="max-h-[55vh] overflow-y-auto rounded-xl border border-[var(--glass-border)]">
        <button
          type="button"
          onClick={() => choose(null)}
          className={cn(
            'flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm transition-colors',
            'hover:bg-[var(--glass-fill)]',
            currentFolderId === null ? 'text-fg' : 'text-fg-muted',
          )}
        >
          <Home size={16} className="shrink-0 text-fg-subtle" />
          <span className="flex-1 truncate">Library (root)</span>
          {currentFolderId === null && <Check size={15} className="text-success" />}
        </button>

        {rows.map(({ folder, depth }) => {
          const disabled = disabledIds?.has(folder.id) ?? false;
          const isCurrent = folder.id === currentFolderId;
          return (
            <button
              key={folder.id}
              type="button"
              disabled={disabled}
              onClick={() => choose(folder.id)}
              style={{ paddingLeft: `${0.875 + depth * 1.1}rem` }}
              className={cn(
                'flex w-full items-center gap-2.5 py-2.5 pr-3.5 text-left text-sm transition-colors',
                disabled
                  ? 'cursor-not-allowed text-fg-subtle opacity-50'
                  : 'hover:bg-[var(--glass-fill)]',
                isCurrent ? 'text-fg' : 'text-fg-muted',
              )}
            >
              <FolderIcon size={16} className="shrink-0 text-[var(--accent-from)]" />
              <span className="flex-1 truncate">{folder.name}</span>
              {isCurrent && <Check size={15} className="text-success" />}
            </button>
          );
        })}
      </div>
    </Modal>
  );
}
