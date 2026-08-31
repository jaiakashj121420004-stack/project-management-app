// Aurora — MCP (Model Context Protocol) server. Lets Claude Desktop/Code read
// and write a user's boards, to-dos, and notes directly, the same shape of
// integration Obsidian offers via its community MCP server. Design record:
// SETUP-MCP.md. Deployment: supabase/README.md.
//
// AUTH MODEL (the one genuinely new piece of infrastructure in this repo —
// read this before touching anything below):
//   1. The caller presents an Aurora MCP personal access token (generated in
//      Settings, see `mcp-token`) as `Authorization: Bearer <token>`. This is
//      NOT a Supabase session JWT, so this function is deployed
//      `--no-verify-jwt` (Supabase's platform JWT gate would otherwise reject
//      it before this code ever runs — same reason `calendar-feed` and
//      `dodo-webhook` are `--no-verify-jwt`).
//   2. We SHA-256-hash the presented token and look it up against
//      `profiles.mcp_token_hash` using the SERVICE ROLE. This is the only use
//      of the service role in this file — authenticating *who is calling*,
//      never used to read/write the user's actual data.
//   3. On a match, we MINT a short-lived (5 min) Supabase-compatible access
//      token for that user (`role: authenticated`, `sub: user_id`), signed
//      with a DEDICATED JWT signing secret (`MCP_JWT_SIGNING_SECRET`) added
//      via Supabase Dashboard → Auth → JWT Signing Keys — a second,
//      independently-revocable key, separate from the project's default
//      session-signing key, so revoking this integration if it's ever
//      compromised never touches real user logins. See SETUP-MCP.md for why
//      this was chosen over `auth.admin.generateLink` (rides Supabase Auth's
//      email-sending rate limits, even with no email sent) and over hand-
//      importing `jose` (Web Crypto's `crypto.subtle` does plain HS256 fine,
//      matching this repo's existing zero-runtime-dependency Edge Function
//      convention).
//   4. EVERY tool handler below talks to PostgREST using THAT minted token
//      (`apikey: <anon key>, Authorization: Bearer <minted JWT>`), never the
//      service role. Row Level Security — the same policies the app itself
//      runs under — is what decides what a tool can see or change. No ACL
//      logic is duplicated here.
//
// Not a browser-facing endpoint (Claude Desktop's `mcp-remote` bridge and
// Claude Code both call this as a local process → server request, not from a
// page), so no CORS handling is needed here, unlike the app's other functions.
//
// This file runs on Deno (Supabase Edge Runtime), NOT in the Vite app bundle.

import { McpServer, StreamableHttpTransport } from 'npm:mcp-lite@0.10.0';
import { z } from 'npm:zod@4';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const JWT_SIGNING_SECRET = Deno.env.get('MCP_JWT_SIGNING_SECRET')!;
// Optional: set this if the project's JWT Signing Keys page shows a Key ID
// for the dedicated key — included as the JWT `kid` header so verification
// picks the right key when the project has more than one active signing key.
// Safe to leave unset (omitted from the header) on a single-key project.
const JWT_SIGNING_KEY_ID = Deno.env.get('MCP_JWT_SIGNING_KEY_ID') ?? '';

const RATE_LIMIT_MAX = 60;
const RATE_LIMIT_WINDOW_SECONDS = 60;
const MINTED_JWT_TTL_SECONDS = 300;

// --- Small helpers ------------------------------------------------------

function base64url(bytes: Uint8Array): string {
  let str = '';
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Mints a short-lived, Supabase-recognized HS256 access token for `userId`,
 *  signed with the dedicated MCP signing secret (see the file header). Plain
 *  Web Crypto — no `jose` dependency, matching this repo's existing Edge
 *  Function convention of zero runtime npm dependencies beyond mcp-lite. */
async function mintUserAccessToken(userId: string): Promise<string> {
  const header: Record<string, string> = { alg: 'HS256', typ: 'JWT' };
  if (JWT_SIGNING_KEY_ID) header.kid = JWT_SIGNING_KEY_ID;
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    aud: 'authenticated',
    role: 'authenticated',
    sub: userId,
    iss: `${SUPABASE_URL}/auth/v1`,
    iat: now,
    exp: now + MINTED_JWT_TTL_SECONDS,
  };
  const enc = new TextEncoder();
  const signingInput =
    base64url(enc.encode(JSON.stringify(header))) + '.' + base64url(enc.encode(JSON.stringify(payload)));
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(JWT_SIGNING_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, enc.encode(signingInput));
  return `${signingInput}.${base64url(new Uint8Array(signature))}`;
}

async function rateLimitHit(key: string): Promise<boolean> {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/rate_limit_hit`, {
      method: 'POST',
      headers: {
        apikey: SERVICE_ROLE,
        Authorization: `Bearer ${SERVICE_ROLE}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        p_key: `mcp-server:${key}`,
        p_max: RATE_LIMIT_MAX,
        p_window_seconds: RATE_LIMIT_WINDOW_SECONDS,
      }),
    });
    if (!res.ok) {
      console.error(`rate_limit_hit failed: ${res.status} ${await res.text()}`);
      return true; // fail closed — deny MCP calls when the limiter is unavailable
    }
    return (await res.json()) === true;
  } catch (err) {
    console.error('rate_limit_hit error', err);
    return true; // fail closed — deny MCP calls when the limiter is unavailable
  }
}

interface AuthedProfile {
  userId: string;
  tokenHash: string;
}

/** Looks up the caller's Aurora MCP token (service role — the one and only
 *  service-role use in this file). Returns null on any mismatch/absence;
 *  callers must not distinguish "no such token" from "wrong token" in the
 *  response, same convention as calendar-feed's token lookup. */
async function authenticate(req: Request): Promise<AuthedProfile | null> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) return null;
  const tokenHash = await sha256Hex(token);

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?mcp_token_hash=eq.${tokenHash}&select=id`,
    { headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}` } },
  );
  if (!res.ok) {
    console.error(`MCP token lookup failed: ${res.status} ${await res.text()}`);
    return null;
  }
  const rows = (await res.json()) as { id: string }[];
  const row = rows[0];
  if (!row) return null;
  return { userId: row.id, tokenHash };
}

/** Fire-and-forget — never blocks or fails the actual tool call. */
function touchLastUsed(userId: string): void {
  fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`, {
    method: 'PATCH',
    headers: {
      apikey: SERVICE_ROLE,
      Authorization: `Bearer ${SERVICE_ROLE}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ mcp_token_last_used_at: new Date().toISOString() }),
  }).catch((err) => console.error('touchLastUsed failed', err));
}

/** Per-request PostgREST client scoped to the caller's MINTED user JWT — the
 *  one and only way tool handlers touch data. Row Level Security applies
 *  exactly as it does for the app itself; nothing here bypasses it. */
function restClientFor(userJwt: string) {
  const authHeaders = {
    apikey: ANON_KEY,
    Authorization: `Bearer ${userJwt}`,
    'Content-Type': 'application/json',
  };
  return {
    async select<T>(path: string): Promise<T> {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: authHeaders });
      if (!res.ok) throw new Error(`Query failed (${res.status}): ${await res.text()}`);
      return (await res.json()) as T;
    },
    async insert<T>(table: string, body: Record<string, unknown>): Promise<T> {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
        method: 'POST',
        headers: { ...authHeaders, Prefer: 'return=representation' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`Insert failed (${res.status}): ${await res.text()}`);
      const rows = (await res.json()) as T[];
      return rows[0];
    },
    async patch<T>(table: string, filter: string, body: Record<string, unknown>): Promise<T> {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${filter}`, {
        method: 'PATCH',
        headers: { ...authHeaders, Prefer: 'return=representation' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`Update failed (${res.status}): ${await res.text()}`);
      const rows = (await res.json()) as T[];
      if (rows.length === 0) throw new Error('Not found, or you do not have access to it.');
      return rows[0];
    },
  };
}

type Rest = ReturnType<typeof restClientFor>;

// Appends `text` as one or more paragraphs to a Tiptap-shaped doc. Hand-built
// minimal Tiptap JSON (doc > paragraph > text) rather than importing the
// app's editor/ProseMirror stack into this Deno function — a plain paragraph
// node is valid under every extension set this app's editor uses.
function appendParagraphs(doc: Record<string, unknown> | null, text: string): Record<string, unknown> {
  const existing = (doc?.content as unknown[] | undefined) ?? [];
  const newParagraphs = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => ({ type: 'paragraph', content: [{ type: 'text', text: p }] }));
  return { type: 'doc', content: [...existing, ...newParagraphs] };
}

// --- Tool position helper (append-at-end only — see src/lib/ordering.ts for
// the app's full fractional-positioning system, which this intentionally does
// not reimplement; appending only ever needs "bigger than the current max",
// never a rebalance). ---
const POSITION_STEP = 1000;

async function nextPosition(rest: Rest, table: string, filterColumn: string, filterValue: string): Promise<number> {
  const rows = await rest.select<{ position: number }[]>(
    `${table}?${filterColumn}=eq.${filterValue}&select=position&order=position.desc&limit=1`,
  );
  return (rows[0]?.position ?? 0) + POSITION_STEP;
}

// --- MCP server + tools ---------------------------------------------------

const mcp = new McpServer({
  name: 'aurora',
  version: '1.0.0',
  schemaAdapter: (schema) => z.toJSONSchema(schema as z.ZodType),
});

// mcp-lite's own request pipeline (server.use / ctx.request) operates on the
// already-parsed JSON-RPC message, NOT the raw HTTP Request — there is no
// Authorization header to read from inside it. Authentication therefore
// happens in OUR Deno.serve handler below, using the real Request, and the
// result is handed to mcp-lite via StreamableHttpTransport.bind()'s own
// `authInfo` option (confirmed from the library's shipped .d.ts — the
// "AuthInfo" type/passthrough exists specifically for this). ctx.authInfo.extra
// carries the RLS-scoped REST client through to every tool handler below.
mcp.use(async (ctx, next) => {
  const extra = ctx.authInfo?.extra as { userId: string; rest: Rest } | undefined;
  if (!extra) {
    // Should be unreachable — Deno.serve below never calls into mcp-lite
    // without a resolved authInfo. Defense in depth only.
    throw new Error('Unauthorized: missing Aurora access token.');
  }
  ctx.state.rest = extra.rest;
  ctx.state.userId = extra.userId;
  await next();
});

function restOf(ctx: { state: Record<string, unknown> }): Rest {
  return ctx.state.rest as Rest;
}

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD.');
const uuid = z.string().uuid();

mcp.tool('list_projects', {
  description: "List every Aurora project the caller is a member of (id, name, description, accent, target date).",
  inputSchema: z.object({}),
  handler: async (_args, ctx) => {
    const rows = await restOf(ctx).select(
      'projects?select=id,name,description,accent,target_date,created_at&order=created_at.desc',
    );
    return { content: [{ type: 'text', text: JSON.stringify(rows, null, 2) }] };
  },
});

mcp.tool('list_board_cards', {
  description: "List a project's Kanban columns and cards.",
  inputSchema: z.object({ project_id: uuid }),
  handler: async (args, ctx) => {
    const rest = restOf(ctx);
    const [columns, cards] = await Promise.all([
      rest.select(`columns?project_id=eq.${args.project_id}&select=id,name,position&order=position.asc`),
      rest.select(
        `cards?project_id=eq.${args.project_id}&select=id,column_id,title,description,due_date,priority,position&order=position.asc`,
      ),
    ]);
    return { content: [{ type: 'text', text: JSON.stringify({ columns, cards }, null, 2) }] };
  },
});

mcp.tool('create_card', {
  description: 'Create a new card in a project column. Appears at the bottom of the column.',
  inputSchema: z.object({
    project_id: uuid,
    column_id: uuid,
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().max(5000).optional(),
    due_date: isoDate.optional(),
  }),
  handler: async (args, ctx) => {
    const rest = restOf(ctx);
    const position = await nextPosition(rest, 'cards', 'column_id', args.column_id);
    const card = await rest.insert('cards', {
      project_id: args.project_id,
      column_id: args.column_id,
      title: args.title,
      description: args.description ?? null,
      due_date: args.due_date ?? null,
      position,
    });
    return { content: [{ type: 'text', text: JSON.stringify(card, null, 2) }] };
  },
});

mcp.tool('update_card', {
  description: 'Update a card — any of title, description, due date, or which column it is in.',
  inputSchema: z.object({
    card_id: uuid,
    title: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().max(5000).nullable().optional(),
    due_date: isoDate.nullable().optional(),
    column_id: uuid.optional(),
  }),
  handler: async (args, ctx) => {
    const { card_id, ...patch } = args;
    if (Object.keys(patch).length === 0) {
      throw new Error('Provide at least one field to update.');
    }
    const card = await restOf(ctx).patch('cards', `id=eq.${card_id}`, patch);
    return { content: [{ type: 'text', text: JSON.stringify(card, null, 2) }] };
  },
});

mcp.tool('list_todos', {
  description: "List the caller's to-do lists and items for a given day.",
  inputSchema: z.object({ date: isoDate }),
  handler: async (args, ctx) => {
    const rest = restOf(ctx);
    const lists = await rest.select<{ id: string; name: string; position: number }[]>(
      `todo_lists?list_date=eq.${args.date}&select=id,name,position&order=position.asc`,
    );
    if (lists.length === 0) {
      return { content: [{ type: 'text', text: JSON.stringify({ lists: [], items: [] }, null, 2) }] };
    }
    const listIds = lists.map((l) => l.id).join(',');
    const items = await rest.select(
      `todo_items?list_id=in.(${listIds})&select=id,list_id,text,is_done,priority,position&order=position.asc`,
    );
    return { content: [{ type: 'text', text: JSON.stringify({ lists, items }, null, 2) }] };
  },
});

const DEFAULT_TODO_LIST_NAME = 'Tasks';

mcp.tool('add_todo_item', {
  description:
    'Add a to-do item to a given day. Finds or creates a list for that day (default list name "Tasks", or pass list_name to use/create a specific one).',
  inputSchema: z.object({
    date: isoDate,
    text: z.string().trim().min(1).max(500),
    priority: z.number().int().min(1).max(4).optional(),
    list_name: z.string().trim().min(1).max(60).optional(),
  }),
  handler: async (args, ctx) => {
    const rest = restOf(ctx);
    const listName = args.list_name ?? DEFAULT_TODO_LIST_NAME;
    const existing = await rest.select<{ id: string }[]>(
      `todo_lists?list_date=eq.${args.date}&name=eq.${encodeURIComponent(listName)}&select=id&limit=1`,
    );
    const list =
      existing[0] ??
      (await rest.insert<{ id: string }>('todo_lists', {
        list_date: args.date,
        name: listName,
        position: await nextPosition(rest, 'todo_lists', 'list_date', args.date),
      }));
    const position = await nextPosition(rest, 'todo_items', 'list_id', list.id);
    const item = await rest.insert('todo_items', {
      list_id: list.id,
      text: args.text,
      priority: args.priority ?? null,
      position,
    });
    return { content: [{ type: 'text', text: JSON.stringify(item, null, 2) }] };
  },
});

mcp.tool('toggle_todo_item', {
  description: 'Mark a to-do item done or not done.',
  inputSchema: z.object({ id: uuid, done: z.boolean() }),
  handler: async (args, ctx) => {
    const item = await restOf(ctx).patch('todo_items', `id=eq.${args.id}`, { is_done: args.done });
    return { content: [{ type: 'text', text: JSON.stringify(item, null, 2) }] };
  },
});

mcp.tool('list_notes', {
  description:
    'List notes — either a project\'s notes (pass project_id) or the caller\'s standalone Library notes (omit it). Titles and metadata only; use read_note for content.',
  inputSchema: z.object({ project_id: uuid.optional() }),
  handler: async (args, ctx) => {
    const filter = args.project_id ? `project_id=eq.${args.project_id}` : 'project_id=is.null';
    const rows = await restOf(ctx).select(
      `notes?${filter}&select=id,title,icon,project_id,updated_at&order=updated_at.desc`,
    );
    return { content: [{ type: 'text', text: JSON.stringify(rows, null, 2) }] };
  },
});

mcp.tool('read_note', {
  description: "Read a note's full plain-text content.",
  inputSchema: z.object({ note_id: uuid }),
  handler: async (args, ctx) => {
    const rows = await restOf(ctx).select<
      { id: string; title: string; content: string; updated_at: string }[]
    >(`notes?id=eq.${args.note_id}&select=id,title,content,updated_at&limit=1`);
    const note = rows[0];
    if (!note) throw new Error('Note not found, or you do not have access to it.');
    return { content: [{ type: 'text', text: JSON.stringify(note, null, 2) }] };
  },
});

mcp.tool('append_to_note', {
  description: "Append a paragraph of text to the end of an existing note.",
  inputSchema: z.object({ note_id: uuid, content: z.string().trim().min(1).max(20_000) }),
  handler: async (args, ctx) => {
    const rest = restOf(ctx);
    const rows = await rest.select<
      { id: string; content: string; content_json: Record<string, unknown> | null }[]
    >(`notes?id=eq.${args.note_id}&select=id,content,content_json&limit=1`);
    const note = rows[0];
    if (!note) throw new Error('Note not found, or you do not have access to it.');
    const newContentJson = appendParagraphs(note.content_json, args.content);
    const newContent = note.content ? `${note.content}\n\n${args.content}` : args.content;
    const updated = await rest.patch('notes', `id=eq.${args.note_id}`, {
      content: newContent,
      content_json: newContentJson,
    });
    return { content: [{ type: 'text', text: JSON.stringify(updated, null, 2) }] };
  },
});

const transport = new StreamableHttpTransport();
const httpHandler = transport.bind(mcp);

function unauthorized(message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  try {
    // Authenticate using the RAW request, before mcp-lite ever sees it (see
    // the mcp.use() comment above for why this can't happen inside mcp-lite
    // itself). Everything past this point runs as the resolved user via RLS.
    const authed = await authenticate(req);
    if (!authed) return unauthorized('Missing, invalid, or revoked Aurora access token.');
    if (await rateLimitHit(authed.tokenHash)) {
      return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please slow down and try again shortly.' }), {
        status: 429,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const userJwt = await mintUserAccessToken(authed.userId);
    touchLastUsed(authed.userId);

    return await httpHandler(req, {
      authInfo: {
        token: 'redacted',
        scopes: ['authenticated'],
        extra: { userId: authed.userId, rest: restClientFor(userJwt) },
      },
    });
  } catch (err) {
    // Never leak internals — mirrors every other function in this repo.
    console.error(err);
    return new Response(JSON.stringify({ error: 'Something went wrong. Please try again.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
