/**
 * SupabaseYjsProvider.ts — a THIN custom Yjs provider over Supabase Realtime.
 *
 * Rather than pull in a heavyweight provider (y-websocket needs a server;
 * `y-supabase` is immature), this moves Yjs document updates + awareness over a
 * single Supabase Realtime *broadcast* channel, `canvas:<noteId>`, joined as a
 * PRIVATE channel so every message is authorised by RLS on `realtime.messages`
 * (see 20260629120000_canvas_realtime.sql): viewers receive, only editors send.
 *
 * Wire protocol (all payloads base64-encoded Uint8Arrays):
 *   - `sync-step-1` {sv}     — on join, "here is my state vector, send me the rest".
 *   - `sync-step-2` {update} — a reply: the ops the requester is missing.
 *   - `update`      {update} — a live local Yjs update to apply everywhere.
 *   - `awareness`   {update} — an awareness (cursor/selection) update.
 *
 * Updates are applied with `this` as the transaction origin so the document's
 * own `update` handler can tell remote echoes from local edits and not loop.
 */
import * as Y from 'yjs';
import {
  Awareness,
  applyAwarenessUpdate,
  encodeAwarenessUpdate,
  removeAwarenessStates,
} from 'y-protocols/awareness';
import {
  REALTIME_SUBSCRIBE_STATES,
  type RealtimeChannel,
  type SupabaseClient,
} from '@supabase/supabase-js';
import { bytesToBase64, base64ToBytes } from './encoding';

export type ProviderStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

type SyncEvent = 'sync-step-1' | 'sync-step-2' | 'update' | 'awareness';

interface ProviderOptions {
  supabase: SupabaseClient;
  noteId: string;
  doc: Y.Doc;
  awareness: Awareness;
  onStatus?: (status: ProviderStatus) => void;
  /** Warn if an outgoing payload exceeds this many bytes (broadcast soft cap). */
  maxPayloadBytes?: number;
}

/** Broadcast soft cap; Supabase rejects very large messages. Yjs deltas are tiny
 *  (media bytes never enter the doc), so this only guards pathological cases. */
const DEFAULT_MAX_PAYLOAD = 200_000;
/** Throttle awareness (cursor) broadcasts — pointer moves fire far too often. */
const AWARENESS_THROTTLE_MS = 50;

export class SupabaseYjsProvider {
  readonly awareness: Awareness;
  private readonly supabase: SupabaseClient;
  private readonly doc: Y.Doc;
  private readonly noteId: string;
  private readonly onStatus?: (status: ProviderStatus) => void;
  private readonly maxPayloadBytes: number;
  private channel: RealtimeChannel | null = null;
  private destroyed = false;

  private awarenessTimer: number | null = null;
  private pendingAwarenessClients: number[] = [];

  constructor(options: ProviderOptions) {
    this.supabase = options.supabase;
    this.noteId = options.noteId;
    this.doc = options.doc;
    this.awareness = options.awareness;
    this.onStatus = options.onStatus;
    this.maxPayloadBytes = options.maxPayloadBytes ?? DEFAULT_MAX_PAYLOAD;

    this.doc.on('update', this.handleDocUpdate);
    this.awareness.on('update', this.handleAwarenessUpdate);
  }

  /** Open the channel and run the initial sync handshake. */
  async connect(): Promise<void> {
    if (this.destroyed) return;
    this.onStatus?.('connecting');
    // Private channels authorise against the user's JWT; make sure Realtime has it.
    await this.supabase.realtime.setAuth();
    if (this.destroyed) return;

    const channel = this.supabase.channel(`canvas:${this.noteId}`, {
      config: { broadcast: { self: false, ack: false }, private: true },
    });
    this.channel = channel;

    channel.on('broadcast', { event: 'sync-step-1' }, ({ payload }) =>
      this.onSyncStep1(payload as { sv: string }),
    );
    channel.on('broadcast', { event: 'sync-step-2' }, ({ payload }) =>
      this.onRemoteUpdate(payload as { update: string }),
    );
    channel.on('broadcast', { event: 'update' }, ({ payload }) =>
      this.onRemoteUpdate(payload as { update: string }),
    );
    channel.on('broadcast', { event: 'awareness' }, ({ payload }) =>
      this.onRemoteAwareness(payload as { update: string }),
    );

    channel.subscribe((status) => {
      if (this.destroyed) return;
      if (status === REALTIME_SUBSCRIBE_STATES.SUBSCRIBED) {
        this.onStatus?.('connected');
        // (Re)join: ask peers for anything we're missing, and (re)publish our
        // presence. Safe to repeat after a reconnect.
        this.requestSync();
        this.publishAwareness([this.awareness.clientID]);
      } else if (
        status === REALTIME_SUBSCRIBE_STATES.CHANNEL_ERROR ||
        status === REALTIME_SUBSCRIBE_STATES.TIMED_OUT
      ) {
        this.onStatus?.('error');
      } else if (status === REALTIME_SUBSCRIBE_STATES.CLOSED) {
        this.onStatus?.('disconnected');
      }
    });
  }

  /** Tear down: clear our presence, detach handlers, remove the channel. */
  destroy(): void {
    this.destroyed = true;
    this.doc.off('update', this.handleDocUpdate);
    this.awareness.off('update', this.handleAwarenessUpdate);
    if (this.awarenessTimer !== null) window.clearTimeout(this.awarenessTimer);
    // Tell peers we're gone (best-effort) before dropping the channel.
    removeAwarenessStates(this.awareness, [this.awareness.clientID], 'provider-destroy');
    if (this.channel) {
      void this.supabase.removeChannel(this.channel);
      this.channel = null;
    }
  }

  // ── outgoing ────────────────────────────────────────────────────────────────

  private handleDocUpdate = (update: Uint8Array, origin: unknown): void => {
    // Echoes of updates we applied ourselves carry `this` as the origin — never
    // rebroadcast those, or two clients would ping-pong forever.
    if (origin === this) return;
    this.send('update', { update: bytesToBase64(update) });
  };

  private handleAwarenessUpdate = (
    changes: { added: number[]; updated: number[]; removed: number[] },
    origin: unknown,
  ): void => {
    if (origin === this) return;
    const clients = [...changes.added, ...changes.updated, ...changes.removed];
    // Coalesce rapid cursor moves into one throttled broadcast.
    this.pendingAwarenessClients.push(...clients);
    if (this.awarenessTimer !== null) return;
    this.awarenessTimer = window.setTimeout(() => {
      this.awarenessTimer = null;
      const unique = [...new Set(this.pendingAwarenessClients)];
      this.pendingAwarenessClients = [];
      this.publishAwareness(unique);
    }, AWARENESS_THROTTLE_MS);
  };

  private requestSync(): void {
    this.send('sync-step-1', { sv: bytesToBase64(Y.encodeStateVector(this.doc)) });
  }

  private publishAwareness(clients: number[]): void {
    if (clients.length === 0) return;
    const update = encodeAwarenessUpdate(this.awareness, clients);
    this.send('awareness', { update: bytesToBase64(update) });
  }

  private send(event: SyncEvent, payload: { sv: string } | { update: string }): void {
    if (!this.channel || this.destroyed) return;
    const size = 'sv' in payload ? payload.sv.length : payload.update.length;
    if (size > this.maxPayloadBytes) {
      console.warn(`[canvas] dropping oversized ${event} payload (${size} bytes)`);
      return;
    }
    void this.channel.send({ type: 'broadcast', event, payload });
  }

  // ── incoming ──────────────────────────────────────────────────────────────

  private onSyncStep1(payload: { sv: string }): void {
    if (this.destroyed) return;
    const remoteSv = base64ToBytes(payload.sv);
    const diff = Y.encodeStateAsUpdate(this.doc, remoteSv);
    this.send('sync-step-2', { update: bytesToBase64(diff) });
  }

  private onRemoteUpdate(payload: { update: string }): void {
    if (this.destroyed) return;
    Y.applyUpdate(this.doc, base64ToBytes(payload.update), this);
  }

  private onRemoteAwareness(payload: { update: string }): void {
    if (this.destroyed) return;
    applyAwarenessUpdate(this.awareness, base64ToBytes(payload.update), this);
  }
}
