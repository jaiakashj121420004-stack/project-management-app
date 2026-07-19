import { useState } from 'react';
import { ChevronRight, FolderIcon, Home, Plus } from 'lucide-react';
import { cn } from '@/lib/cn';
import { EmojiPicker } from '@/components/forms/EmojiPicker';
import type { Folder } from '@/types/database';
import { buildFolderTree, folderPath, type FolderNode } from './tree';
import { useSetFolderIcon } from './useLibrary';

interface FolderTreeProps {
  folders: Folder[];
  currentFolderId: string | null;
  onSelect: (folderId: string | null) => void;
  /** Create a new folder at the current location. */
  onNewFolder: () => void;
  canEdit: boolean;
}

/**
 * The desktop-only sidebar tree: a "Library" root plus every folder, infinitely
 * nested, expand/collapse per branch. The ancestors of the current folder are
 * auto-expanded so the selection is always visible. On mobile this whole panel is
 * hidden — navigation there is the tap-into-folder drill-down of the contents view.
 */
export function FolderTree({
  folders,
  currentFolderId,
  onSelect,
  onNewFolder,
  canEdit,
}: FolderTreeProps) {
  const tree = buildFolderTree(folders);
  const setFolderIcon = useSetFolderIcon();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Keep the path to the current folder open whenever the selection changes.
  // Done at render time (functional setState, not in an effect) so the ancestor
  // chain expands without a cascading effect render.
  const [prevPathKey, setPrevPathKey] = useState<string | null>(null);
  const pathKey = `${currentFolderId ?? ''}|${folders.length}`;
  if (pathKey !== prevPathKey) {
    setPrevPathKey(pathKey);
    const ancestors = folderPath(folders, currentFolderId).map((f) => f.id);
    if (ancestors.length > 0) {
      setExpanded((prev) => {
        const next = new Set(prev);
        for (const id of ancestors) next.add(id);
        return next;
      });
    }
  }

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <nav className="flex flex-col gap-1">
      <div className="mb-1 flex items-center justify-between px-1">
        <span className="text-xs font-semibold uppercase tracking-wide text-fg-subtle">Library</span>
        {canEdit && (
          <button
            type="button"
            aria-label="New folder"
            onClick={onNewFolder}
            className="grid h-7 w-7 place-items-center rounded-lg text-fg-subtle transition-colors hover:bg-[var(--glass-fill)] hover:text-fg"
          >
            <Plus size={16} />
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={() => onSelect(null)}
        className={cn(
          'flex items-center gap-2 rounded-xl px-2.5 py-2 text-sm transition-colors',
          currentFolderId === null
            ? 'bg-[var(--accent-from)]/12 font-semibold text-fg'
            : 'text-fg-muted hover:bg-[var(--glass-fill)] hover:text-fg',
        )}
      >
        <Home size={16} className="shrink-0" />
        All items
      </button>

      {tree.map((node) => (
        <TreeRow
          key={node.id}
          node={node}
          depth={0}
          currentFolderId={currentFolderId}
          expanded={expanded}
          onToggle={toggle}
          onSelect={onSelect}
          canEdit={canEdit}
          onSetIcon={(id, icon) => setFolderIcon.mutate({ id, icon })}
        />
      ))}
    </nav>
  );
}

interface TreeRowProps {
  node: FolderNode;
  depth: number;
  currentFolderId: string | null;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  onSelect: (folderId: string) => void;
  canEdit: boolean;
  onSetIcon: (id: string, icon: string | null) => void;
}

function TreeRow({
  node,
  depth,
  currentFolderId,
  expanded,
  onToggle,
  onSelect,
  canEdit,
  onSetIcon,
}: TreeRowProps) {
  const isOpen = expanded.has(node.id);
  const hasChildren = node.children.length > 0;
  const isActive = node.id === currentFolderId;

  return (
    <div>
      <div
        className={cn(
          'group flex items-center gap-1 rounded-xl pr-2 transition-colors',
          isActive
            ? 'bg-[var(--accent-from)]/12 text-fg'
            : 'text-fg-muted hover:bg-[var(--glass-fill)]',
        )}
        style={{ paddingLeft: `${0.25 + depth * 0.85}rem` }}
      >
        <button
          type="button"
          aria-label={isOpen ? 'Collapse' : 'Expand'}
          onClick={() => hasChildren && onToggle(node.id)}
          className={cn(
            'grid h-6 w-6 shrink-0 place-items-center rounded-md text-fg-subtle',
            hasChildren ? 'hover:text-fg' : 'invisible',
          )}
        >
          <ChevronRight
            size={15}
            className={cn('transition-transform', isOpen && 'rotate-90')}
          />
        </button>
        <button
          type="button"
          onClick={() => onSelect(node.id)}
          className={cn(
            'flex min-w-0 flex-1 items-center gap-2 py-2 text-left text-sm',
            isActive && 'font-semibold',
          )}
        >
          {node.icon ? (
            <span className="grid h-[15px] w-[15px] shrink-0 place-items-center text-sm leading-none">
              {node.icon}
            </span>
          ) : (
            <FolderIcon
              size={15}
              className={cn('shrink-0', isActive ? 'text-[var(--accent-from)]' : 'text-fg-subtle')}
            />
          )}
          <span className="truncate">{node.name}</span>
        </button>
        {canEdit && (
          <EmojiPicker
            value={node.icon}
            onSelect={(emoji) => onSetIcon(node.id, emoji)}
            ariaLabel={`Set icon for ${node.name}`}
            buttonClassName="h-6 w-6 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
            iconSize={13}
          />
        )}
      </div>

      {isOpen &&
        node.children.map((child) => (
          <TreeRow
            key={child.id}
            node={child}
            depth={depth + 1}
            currentFolderId={currentFolderId}
            expanded={expanded}
            onToggle={onToggle}
            onSelect={onSelect}
            canEdit={canEdit}
            onSetIcon={onSetIcon}
          />
        ))}
    </div>
  );
}
