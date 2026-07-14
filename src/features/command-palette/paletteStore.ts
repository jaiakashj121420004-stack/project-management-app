/**
 * paletteStore.ts — a tiny, dependency-free open-state store for the command
 * palette (Phase 4).
 *
 * The palette was previously openable only by its own ⌘K / Ctrl-K key handler,
 * so the prominent Topbar "Search projects, cards, notes…" button — the app's
 * most visible affordance — did nothing (audit §1, "dead primary affordance").
 * Lifting the open-state into a module-level pub/sub (mirrors `feedback/toast.ts`)
 * lets *any* component — the Topbar button, a future "/" hint, etc. — open the
 * palette without prop-drilling through the shell. The palette subscribes via
 * `useSyncExternalStore`; the keyboard shortcut lives on the palette too.
 */

type Listener = (open: boolean) => void;

const listeners = new Set<Listener>();
let open = false;

function emit(): void {
  for (const listener of listeners) listener(open);
}

/** Subscribe to open-state changes; returns an unsubscribe fn. */
export function subscribeToPalette(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Current open-state (for `useSyncExternalStore`'s snapshot). */
export function getPaletteOpen(): boolean {
  return open;
}

function set(next: boolean): void {
  if (open === next) return;
  open = next;
  emit();
}

/** Open the command palette (e.g. from the Topbar search button). */
export function openCommandPalette(): void {
  set(true);
}

/** Close the command palette. */
export function closeCommandPalette(): void {
  set(false);
}

/** Toggle the command palette (the ⌘K / Ctrl-K behaviour). */
export function toggleCommandPalette(): void {
  set(!open);
}
