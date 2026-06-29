/**
 * encoding.ts — byte (de)serialisation for the collaborative canvas.
 *
 * Two wire formats:
 *   - HEX (`\x…`) for the `canvas_notes.doc_state` BYTEA column. PostgREST
 *     returns a bytea as a Postgres hex string (`\x0a1b…`) and accepts the same
 *     format on write, so `Y.encodeStateAsUpdate` round-trips through it.
 *   - BASE64 for Supabase Realtime broadcast payloads (JSON transport can't
 *     carry a Uint8Array, so each Yjs/awareness update is base64-encoded).
 */

/** Uint8Array → Postgres bytea hex literal (`\x…`). */
export function bytesToPgHex(bytes: Uint8Array): string {
  let hex = '';
  for (const byte of bytes) hex += byte.toString(16).padStart(2, '0');
  return `\\x${hex}`;
}

/** Postgres bytea hex string (`\x…`) → Uint8Array. Tolerates an absent prefix. */
export function pgHexToBytes(hex: string): Uint8Array {
  const body = hex.startsWith('\\x') ? hex.slice(2) : hex;
  const length = body.length >> 1;
  const out = new Uint8Array(length);
  for (let i = 0; i < length; i++) {
    out[i] = parseInt(body.substr(i * 2, 2), 16);
  }
  return out;
}

/** Uint8Array → base64 string (broadcast payload). */
export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000; // avoid call-stack limits on large inputs
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/** base64 string → Uint8Array (broadcast payload). */
export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}
