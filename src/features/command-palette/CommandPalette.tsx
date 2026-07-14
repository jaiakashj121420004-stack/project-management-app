import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Search } from 'lucide-react';
import { NAV_ITEMS } from '@/components/shell/navItems';
import { cn } from '@/lib/cn';

interface Command {
  id: string;
  label: string;
  hint: string;
  icon: (typeof NAV_ITEMS)[number]['icon'];
  run: () => void;
}

/**
 * A ⌘K / Ctrl-K command palette (Phase 6). Opens over the app, filters the app's
 * destinations, and navigates on Enter. Keyboard-first (↑/↓/Enter/Esc); click
 * works too. Mounted once in the app shell; self-contained (no data deps).
 */
export function CommandPalette() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);

  // Global open shortcut.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Reset the query/selection each time it opens.
  useEffect(() => {
    if (open) {
      setQuery('');
      setIndex(0);
    }
  }, [open]);

  const commands = useMemo<Command[]>(
    () =>
      NAV_ITEMS.filter((item) => !item.adminOnly).map((item) => ({
        id: item.to,
        label: item.label,
        hint: 'Go to',
        icon: item.icon,
        run: () => navigate(item.to),
      })),
    [navigate],
  );

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((command) => command.label.toLowerCase().includes(q));
  }, [commands, query]);

  useEffect(() => setIndex(0), [query]);

  function choose(i: number) {
    const command = results[i];
    if (!command) return;
    command.run();
    setOpen(false);
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
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
    }
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
            onClick={() => setOpen(false)}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            className="glass-strong relative z-10 w-full max-w-lg overflow-hidden rounded-2xl"
          >
            <div className="flex items-center gap-2 border-b border-[var(--glass-border)] px-3.5">
              <Search size={16} className="shrink-0 text-fg-subtle" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Search destinations…"
                aria-label="Command palette search"
                className="w-full bg-transparent py-3 text-sm text-fg placeholder:text-fg-subtle focus:outline-none"
              />
              <kbd className="hidden rounded bg-[var(--glass-fill)] px-1.5 py-0.5 text-[10px] text-fg-subtle sm:block">
                Esc
              </kbd>
            </div>
            <div className="max-h-80 overflow-y-auto p-1.5">
              {results.length === 0 ? (
                <p className="px-3 py-6 text-center text-sm text-fg-subtle">No matches</p>
              ) : (
                results.map((command, i) => {
                  const Icon = command.icon;
                  return (
                    <button
                      key={command.id}
                      type="button"
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
                      <span className="flex-1 text-sm font-medium text-fg">{command.label}</span>
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
