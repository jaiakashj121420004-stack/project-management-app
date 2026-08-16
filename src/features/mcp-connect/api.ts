import { supabase } from '@/lib/supabase';

/**
 * Data layer for connecting Claude Desktop/Code to Aurora via MCP — talks to
 * the `mcp-token` Edge Function, the only writer of `profiles.mcp_token_*` (a
 * DB trigger blocks the client from setting them directly). Unlike the
 * calendar feed token, the MCP token's PLAINTEXT is never stored server-side
 * and is only ever returned once, from `generateToken`/`rotateToken` — see
 * SETUP-MCP.md.
 */

export interface McpTokenStatus {
  exists: boolean;
  createdAt: string | null;
  lastUsedAt: string | null;
}

interface StatusResponse extends Partial<McpTokenStatus> {
  error?: string;
}

interface GenerateResponse {
  token?: string;
  createdAt?: string;
  error?: string;
}

async function invoke<T extends { error?: string }>(
  method: 'GET' | 'POST' | 'DELETE',
  body?: Record<string, unknown>,
): Promise<T> {
  const { data, error } = (await supabase.functions.invoke<T>('mcp-token', { method, body })) as {
    data: T | null;
    error: Error | null;
  };
  if (error) throw error;
  if (!data) throw new Error('No response from the server.');
  if (data.error) throw new Error(data.error);
  return data;
}

/** Whether the caller has an MCP token, and when it was created/last used —
 *  NEVER the plaintext (it is never stored, only shown once at generation). */
export async function fetchMcpTokenStatus(): Promise<McpTokenStatus> {
  const data = await invoke<StatusResponse>('GET');
  return {
    exists: data.exists ?? false,
    createdAt: data.createdAt ?? null,
    lastUsedAt: data.lastUsedAt ?? null,
  };
}

/** Generates a token if none exists yet. Returns the PLAINTEXT token — shown
 *  to the user exactly once; it can never be retrieved again after this. */
export async function generateMcpToken(): Promise<string> {
  const data = await invoke<GenerateResponse>('POST', { rotate: false });
  if (!data.token) throw new Error('A token already exists — use "Regenerate" to replace it.');
  return data.token;
}

/** Issues a brand-new token, invalidating the previous one immediately. */
export async function rotateMcpToken(): Promise<string> {
  const data = await invoke<GenerateResponse>('POST', { rotate: true });
  if (!data.token) throw new Error('Something went wrong generating a new token.');
  return data.token;
}

/** Revokes the token — Claude can no longer authenticate until a new one is generated. */
export async function revokeMcpToken(): Promise<void> {
  await invoke<StatusResponse>('DELETE');
}
