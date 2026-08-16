// Aurora — public read-only project share view.
//
// Unauthenticated GET endpoint (deployed with `--no-verify-jwt`, like
// calendar-feed/dodo-webhook — the browser hitting `/share/:token` has no
// Supabase session). A request must carry `?token=<uuid>` matching an ACTIVE
// row in `project_share_links` (see 20260816140000_project_share_links.sql,
// which also has the full design rationale); an unknown, malformed, or
// revoked token always gets the same 404, so this endpoint can't be used to
// enumerate valid tokens or distinguish "never existed" from "revoked".
//
// Returns a stripped-down, read-only snapshot of the board: the project's
// name/description/accent, its columns, and its cards (title, description,
// due date, position) with their labels — deliberately NOT comments, checklist
// items, assignees, review status, or any member/identity data, matching the
// public route's scope (no edit affordances, no member list reachable from
// it). The token is opaque, unguessable (a random UUID, DB-generated — see the
// migration), and revocable, so a leaked share URL only ever exposes this
// read-only slice of one project, never write access or anything else in the
// account.
//
// This file runs on Deno (Supabase Edge Runtime), NOT in the Vite app bundle —
// it is excluded from the app's TypeScript/ESLint config on purpose.
//
// Required env: APP_URL (CORS allow-list origin — this is called from our own
// SPA's public /share/:token route, unlike calendar-feed which external
// calendar apps hit directly, so CORS is scoped rather than '*').
// Provided automatically by the Edge runtime: SUPABASE_URL,
// SUPABASE_SERVICE_ROLE_KEY.

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const APP_URL = Deno.env.get('APP_URL') ?? '*';

const corsHeaders = {
  'Access-Control-Allow-Origin': APP_URL,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  Vary: 'Origin',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Canonical v4-ish UUID shape — validated before it's interpolated into a
// PostgREST filter (defence in depth; a malformed token can never widen the
// query, it just fails the exact-match lookup below), same guard as
// calendar-feed.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

function notFound(): Response {
  // Deliberately identical whether the token is missing, malformed, unknown,
  // or revoked — never distinguish (same discipline as calendar-feed).
  return new Response(JSON.stringify({ error: 'Not found' }), {
    status: 404,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Public, no per-caller identity to key on — rate limit by the edge network's
// forwarded client IP, same fallback track-event uses for logged-out callers.
// Generous enough for a real viewer opening the page (one fetch, an occasional
// refresh) while still capping brute-force token guessing.
const RATE_LIMIT_MAX = 30;
const RATE_LIMIT_WINDOW_SECONDS = 60;

async function isRateLimited(key: string): Promise<boolean> {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/rate_limit_hit`, {
      method: 'POST',
      headers: {
        apikey: SERVICE_ROLE,
        Authorization: `Bearer ${SERVICE_ROLE}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        p_key: `project-share:${key}`,
        p_max: RATE_LIMIT_MAX,
        p_window_seconds: RATE_LIMIT_WINDOW_SECONDS,
      }),
    });
    if (!res.ok) {
      console.error(`rate_limit_hit failed: ${res.status} ${await res.text()}`);
      return false; // fail open — a limiter hiccup must never take down every share link
    }
    return (await res.json()) === true;
  } catch (err) {
    console.error('rate_limit_hit error', err);
    return false; // fail open
  }
}

interface ShareLinkRow {
  project_id: string;
  revoked_at: string | null;
}

async function findActiveLinkByToken(token: string): Promise<ShareLinkRow | null> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/project_share_links?token=eq.${token}&revoked_at=is.null&select=project_id,revoked_at`,
    { headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}` } },
  );
  if (!res.ok) throw new Error(`Share link lookup failed: ${res.status} ${await res.text()}`);
  const rows = (await res.json()) as ShareLinkRow[];
  return rows[0] ?? null;
}

interface ProjectRow {
  id: string;
  name: string;
  description: string | null;
  accent: string;
}

async function fetchProject(projectId: string): Promise<ProjectRow | null> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/projects?id=eq.${projectId}&select=id,name,description,accent`,
    { headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}` } },
  );
  if (!res.ok) throw new Error(`Project lookup failed: ${res.status} ${await res.text()}`);
  const rows = (await res.json()) as ProjectRow[];
  return rows[0] ?? null;
}

interface ColumnRow {
  id: string;
  name: string;
  position: number;
}

async function fetchColumns(projectId: string): Promise<ColumnRow[]> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/columns?project_id=eq.${projectId}&select=id,name,position&order=position.asc`,
    { headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}` } },
  );
  if (!res.ok) throw new Error(`Column lookup failed: ${res.status} ${await res.text()}`);
  return (await res.json()) as ColumnRow[];
}

interface CardRow {
  id: string;
  column_id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  due_at: string | null;
  position: number;
}

async function fetchCards(projectId: string): Promise<CardRow[]> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/cards?project_id=eq.${projectId}&select=id,column_id,title,description,due_date,due_at,position&order=position.asc`,
    { headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}` } },
  );
  if (!res.ok) throw new Error(`Card lookup failed: ${res.status} ${await res.text()}`);
  return (await res.json()) as CardRow[];
}

interface CardLabelRow {
  card_id: string;
  label_id: string;
}

async function fetchCardLabels(cardIds: string[]): Promise<CardLabelRow[]> {
  if (cardIds.length === 0) return [];
  const idList = cardIds.join(',');
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/card_labels?card_id=in.(${idList})&select=card_id,label_id`,
    { headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}` } },
  );
  if (!res.ok) throw new Error(`Card label lookup failed: ${res.status} ${await res.text()}`);
  return (await res.json()) as CardLabelRow[];
}

interface LabelRow {
  id: string;
  name: string;
  color: string;
}

async function fetchLabels(projectId: string): Promise<LabelRow[]> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/labels?project_id=eq.${projectId}&select=id,name,color`,
    { headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}` } },
  );
  if (!res.ok) throw new Error(`Label lookup failed: ${res.status} ${await res.text()}`);
  return (await res.json()) as LabelRow[];
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get('token');
    if (!isUuid(token)) return notFound();

    const rateLimitKey = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    if (await isRateLimited(rateLimitKey)) {
      return json({ error: 'Too many requests. Please try again in a moment.' }, 429);
    }

    const link = await findActiveLinkByToken(token);
    if (!link) return notFound();

    const project = await fetchProject(link.project_id);
    // A dangling link (project deleted without the link being cleaned up by
    // its ON DELETE CASCADE — shouldn't happen, but never trust it blindly)
    // reads as the same generic 404 as an invalid token.
    if (!project) return notFound();

    const [columns, cards, labels] = await Promise.all([
      fetchColumns(project.id),
      fetchCards(project.id),
      fetchLabels(project.id),
    ]);
    const cardLabels = await fetchCardLabels(cards.map((c) => c.id));

    const labelsByCard = new Map<string, LabelRow[]>();
    const labelById = new Map(labels.map((l) => [l.id, l]));
    for (const cl of cardLabels) {
      const label = labelById.get(cl.label_id);
      if (!label) continue;
      const bucket = labelsByCard.get(cl.card_id);
      if (bucket) bucket.push(label);
      else labelsByCard.set(cl.card_id, [label]);
    }

    return json({
      project: { name: project.name, description: project.description, accent: project.accent },
      columns: columns.map((c) => ({ id: c.id, name: c.name, position: c.position })),
      cards: cards.map((c) => ({
        id: c.id,
        columnId: c.column_id,
        title: c.title,
        description: c.description,
        dueDate: c.due_date,
        dueAt: c.due_at,
        position: c.position,
        labels: (labelsByCard.get(c.id) ?? []).map((l) => ({ name: l.name, color: l.color })),
      })),
    });
  } catch (err) {
    console.error(err);
    return json({ error: 'Something went wrong. Please try again.' }, 500);
  }
});
