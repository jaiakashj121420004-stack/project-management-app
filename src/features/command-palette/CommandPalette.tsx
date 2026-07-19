import { useEffect, useId, useMemo, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Folder, Layers, PenLine, Search, StickyNote, type LucideIcon } from 'lucide-react';
import { NAV_ITEMS } from '@/components/shell/navItems';
import { useProjects } from '@/features/projects/useProjects';
import { useFolders, useLibraryNotes } from '@/features/library/useLibrary';
import { useAllCanvases } from '@/features/canvas/useCanvas';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { cn } from '@/lib/cn';
import {
  closeCommandPalette,
  getPaletteOpen,
  subscribeToPalette,
  toggleCommandPalette,
} from './paletteStore';

interface Command {
  id: string;
  label: string;
  hint: string;
  icon: LucideIcon;
  run: () => void;
}

/** Cap the typed-search result list so a large workspace can't flood the panel. */
const MAX_RESULTS = 40;

/**
 * A ⌘K / Ctrl-K command palette. Opens over the app, filters the app's
 * destinations *and* the user's own projects, notes, canvases and folders, then
 * navigates on Enter. Keyboard-first (↑/↓/Enter/Esc); click works too. Mounted
 * once in the app shell.
 *
 * Open-state lives in `paletteStore` so the Topbar search button (and anything
 * else) can open it — not just the keyboard shortcut (Phase 4, audit §1: the
 * Topbar search was a dead affordance). The workspace index is read from the
 * shared TanStack caches, so opening the palette navigates instantly once those
 * lists have loaded elsewhere in the app.
 */
export function CommandPalette() {
  const navigate = useNavigate();
  const open = useSyncExternalStore(subscribeToPalette, getPaletteOpen, getPaletteOpen);
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const listId = useId();
  const optionId = (i: number) => `${listId}-opt-${i}`;
  // Trap + restore focus while the palette is open; Esc closes it.
  const dialogRef = useFocusTrap<HTMLDivElement>(open, { onEscape: closeCommandPalette });

  // Reset the query + selection when the palette opens, and snap the selection
  // back to the top whenever the query changes. Done at render time (React's
  // "adjust state while a prop changes" pattern, tracked with state not a ref)
  // rather than in an effect.
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setQuery('');
      setIndex(0);
    }
  }
  const [prevQuery, setPrevQuery] = useState(query);
  if (query !== prevQuery) {
    setPrevQuery(query);
    setIndex(0);
  }

  // Workspace index for "find any project, note, canvas, or folder". Shared
  // caches (same query keys the Boards/Library pages use), so no duplicate fetch.
  const projects = useProjects();
  const folders = useFolders();
  const libraryNotes = useLibraryNotes();
  const canvases = useAllCanvases();

  // Global open/toggle shortcut.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        toggleCommandPalette();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const navCommands = useMemo<Command[]>(
    () =>
      NAV_ITEMS.filter((item) => !item.adminOnly).map((item) => ({
        id: `nav:${item.to}`,
        label: item.label,
        hint: 'Go to',
        icon: item.icon,
        run: () => void navigate(item.to),
      })),
    [navigate],
  );

  const contentCommands = useMemo<Command[]>(() => {
    const projectCmds = (projects.data ?? []).map<Command>((project) => ({
      id: `project:${project.id}`,
      label: project.name,
      hint: 'Project',
      icon: Layers,
      run: () => void navigate(`/projects/${project.id}`),
    }));
    const noteCmds = (libraryNotes.data ?? []).map<Command>((note) => ({
      id: `note:${note.id}`,
      label: note.title || 'Untitled note',
      hint: 'Note',
      icon: StickyNote,
      run: () => void navigate(`/library?note=${note.id}`),
    }));
    // Personal canvases only (project canvases open from their project's tab).
    const canvasCmds = (canvases.data ?? [])
      .filter((canvas) => canvas.project_id === null)
      .map<Command>((canvas) => ({
        id: `canvas:${canvas.id}`,
        label: canvas.title || 'Untitled canvas',
        hint: 'Canvas',
        icon: PenLine,
        run: () => void navigate(`/library?canvas=${canvas.id}`),
      }));
    const folderCmds = (folders.data ?? []).map<Command>((folder) => ({
      id: `folder:${folder.id}`,
      label: folder.name,
      hint: 'Folder',
      icon: Folder,
      run: () => void navigate(`/library?folder=${folder.id}`),
    }));
    return [...projectCmds, ...noteCmds, ...canvasCmds, ...folderCmds];
  }, [navigate, projects.data, libraryNotes.data, canvases.data, folders.data]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    // Empty query: keep it calm — just the app destinations. The full workspace
    // index (notes/canvases/folders) surfaces the moment the user types.
    if (!q) return navCommands;
    return [...navCommands, ...contentCommands]
      .filter((command) => command.label.toLowerCase().includes(q))
      .slice(0, MAX_RESULTS);
  }, [navCommands, contentCommands, query]);

  function choose(i: number) {
    const command = results[i];
    if (!command) return;
    command.run();
    closeCommandPalette();
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setIndex((i) => (results.length ? (i + 1) % results.length : 0));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setIndex((i) => (results.length ? (i + results.length - 1) % results.length : 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      choose(index);
    }
    // Escape is handled by the focus trap (which also restores focus).
  }

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[70] flex items-start justify-center p-4 pt-[12vh]">
          <motion.div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeCommandPalette}
          />
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
            tabIndex={-1}
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            className="glass-strong relative z-10 w-full max-w-lg overflow-hidden rounded-2xl outline-none"
          >
            <div className="flex items-center gap-2 border-b border-[var(--glass-border)] px-3.5">
              <Search size={16} className="shrink-0 text-fg-subtle" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Search projects, notes, canvases…"
                aria-label="Command palette search"
                role="combobox"
                aria-expanded
                aria-controls={listId}
                aria-autocomplete="list"
                aria-activedescendant={results[index] ? optionId(index) : undefined}
                className="w-full bg-transparent py-3 text-sm text-fg placeholder:text-fg-subtle focus:outline-none"
              />
              <kbd className="hidden rounded bg-[var(--glass-fill)] px-1.5 py-0.5 text-[10px] text-fg-subtle sm:block">
                Esc
              </kbd>
            </div>
            <div
              id={listId}
              role="listbox"
              aria-label="Results"
              className="max-h-80 overflow-y-auto p-1.5"
            >
              {results.length === 0 ? (
                <p className="px-3 py-6 text-center text-sm text-fg-subtle">No matches</p>
              ) : (
                results.map((command, i) => {
                  const Icon = command.icon;
                  return (
                    <button
                      key={command.id}
                      id={optionId(i)}
                      type="button"
                      role="option"
                      aria-selected={i === index}
                      tabIndex={-1}
                      onMouseEnter={() => setIndex(i)}
                      onClick={() => choose(i)}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors',
                        i === index ? 'bg-[var(--glass-fill)] text-fg' : 'text-fg-muted',
                      )}
                    >
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[var(--accent-from)]/10 text-[var(--accent-from)]">
                        <Icon size={16} />
                      </span>
                      <span className="flex-1 truncate text-sm font-medium text-fg">
                        {command.label}
                      </span>
                      <span className="text-xs text-fg-subtle">{command.hint}</span>
                    </button>
                  );
                })
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
