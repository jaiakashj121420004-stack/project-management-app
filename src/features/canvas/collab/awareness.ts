/**
 * awareness.ts — presence state shared over the canvas channel (Pro P3.7).
 *
 * Awareness (y-protocols/awareness) carries ephemeral, non-persisted state: who
 * is here, where their cursor is (in WORLD coordinates, so it lands correctly
 * under each peer's own camera), and what they have selected. It is broadcast on
 * the same channel as the Yjs document but never written to the database.
 */
import type { Awareness } from 'y-protocols/awareness';

/**
 * Awareness field keys for the CANVAS presence. These are deliberately
 * namespaced (`canvas*`) so they never collide with the keys
 * @tiptap/extension-collaboration-caret reserves on the SAME awareness instance:
 * it owns `user` (the in-text caret label) and `cursor` (the in-text ProseMirror
 * selection). Writing our pointer `{x,y}` into `cursor` made the caret plugin
 * read it as a text position and crash, so we keep our fields separate.
 */
export const CANVAS_USER_FIELD = 'canvasUser';
export const CANVAS_CURSOR_FIELD = 'canvasCursor';
export const CANVAS_SELECTION_FIELD = 'canvasSelection';

/** The identity + colour shown for a participant's cursor and selection halo. */
export interface CanvasUser {
  id: string;
  name: string;
  /** Cursor / halo colour (hex). Derived from the user id, stable per person. */
  color: string;
  avatarUrl: string | null;
}

/** The full awareness payload one client publishes about itself. */
export interface CanvasAwarenessState {
  user: CanvasUser;
  /** Pointer position in world coordinates, or null when off-canvas. */
  cursor: { x: number; y: number } | null;
  /** Ids of the elements this user currently has selected. */
  selection: string[];
}

/** A remote participant, as rendered on the stage. */
export interface RemotePeer extends CanvasAwarenessState {
  clientId: number;
}

/**
 * A small, high-contrast palette for cursors. Chosen to read clearly over both
 * the light and dark Aurora surfaces and to stay distinct from the project
 * accent (so a remote cursor never blends into a selection Transformer).
 */
const CURSOR_COLORS = [
  '#F43F5E', // rose
  '#06B6D4', // cyan
  '#F59E0B', // amber
  '#8B5CF6', // violet
  '#10B981', // emerald
  '#EC4899', // pink
  '#3B82F6', // blue
  '#F97316', // orange
] as const;

/** Deterministically pick a cursor colour from a user id (stable per person). */
export function cursorColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  return CURSOR_COLORS[hash % CURSOR_COLORS.length]!;
}

/** Type-guard a raw awareness state into our shape (peers are untrusted input). */
function isCanvasState(value: unknown): value is CanvasAwarenessState {
  if (!value || typeof value !== 'object') return false;
  const state = value as Record<string, unknown>;
  const user = state[CANVAS_USER_FIELD] as Record<string, unknown> | undefined;
  return Boolean(user && typeof user.id === 'string' && typeof user.name === 'string');
}

/**
 * Read every remote participant (excluding ourselves) from an Awareness
 * instance, defensively validating each entry. Returns a stable, id-sorted list
 * so React keys don't thrash.
 */
export function readRemotePeers(awareness: Awareness): RemotePeer[] {
  const peers: RemotePeer[] = [];
  const localId = awareness.clientID;
  awareness.getStates().forEach((rawState, clientId) => {
    if (clientId === localId) return;
    if (!isCanvasState(rawState)) return;
    const state = rawState as unknown as Record<string, unknown>;
    const user = state[CANVAS_USER_FIELD] as CanvasUser;
    const cursor = state[CANVAS_CURSOR_FIELD] as { x: number; y: number } | null | undefined;
    const selection = state[CANVAS_SELECTION_FIELD];
    peers.push({
      clientId,
      user,
      cursor: cursor ?? null,
      selection: Array.isArray(selection) ? (selection as string[]) : [],
    });
  });
  peers.sort((a, b) => a.clientId - b.clientId);
  return peers;
}
