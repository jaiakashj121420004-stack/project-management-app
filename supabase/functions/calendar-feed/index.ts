// Aurora — public ICS calendar subscribe feed (Pro).
//
// Unauthenticated GET endpoint (deployed with `--no-verify-jwt`, like
// dodo-webhook — external calendar apps can't send a Supabase session). A
// request must carry `?token=<uuid>` matching a `profiles.calendar_feed_token`
// (see 20260813020000_calendar_feed_token.sql); an unknown/missing token
// always gets the same 404, so this endpoint can't be used to enumerate valid
// tokens or leak which ones exist. The token is opaque, unguessable (a random
// UUID from calendar-feed-token), and rotatable, so leaking a subscribe URL
// only exposes read-only due dates/milestones for that one user — never write
// access to the app itself.
//
// Returns a standard iCalendar (RFC 5545) VCALENDAR: every dated card across
// the caller's accessible projects, every to-do list day, and every project
// milestone with a target date — the same three sources the in-app Calendar
// page shows. Google Calendar / Apple Calendar / Outlook can subscribe to
// this URL directly and it will refresh on their own polling schedule.
//
// This file runs on Deno (Supabase Edge Runtime), NOT in the Vite app bundle —
// it is excluded from the app's TypeScript/ESLint config on purpose.
//
// Provided automatically by the Edge runtime: SUPABASE_URL,
// SUPABASE_SERVICE_ROLE_KEY.

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

// Canonical v4 UUID shape — validated before it's interpolated into a
// PostgREST filter (defence in depth; a malformed token can never widen the
// query, it just fails the exact-match lookup below).
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

function notFound(): Response {
  // Deliberately identical whether the token is missing, malformed, unknown,
  // or belongs to a downgraded (no longer Pro) account — never distinguish.
  return new Response('Not found', { status: 404, headers: corsHeaders });
}

interface ProfileRow {
  id: string;
  plan: string | null;
}

async function findProfileByToken(token: string): Promise<ProfileRow | null> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?calendar_feed_token=eq.${token}&select=id,plan`,
    { headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}` } },
  );
  if (!res.ok) throw new Error(`Profile lookup failed: ${res.status} ${await res.text()}`);
  const rows = (await res.json()) as ProfileRow[];
  return rows[0] ?? null;
}

// 'enterprise' passes too — mirrors isProOrAbove() in src/lib/plans.ts. A
// downgraded account's feed goes 404 rather than silently emptying, so a
// stale subscribe URL fails loudly instead of quietly showing nothing.
function isProOrAbove(plan: string | null): boolean {
  return plan === 'pro' || plan === 'team' || plan === 'enterprise';
}

interface CardRow {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  due_at: string | null;
  project_id: string;
}

interface TodoListRow {
  id: string;
  name: string;
  list_date: string;
}

interface TodoItemRow {
  list_id: string;
  text: string;
  is_done: boolean;
}

interface ProjectRow {
  id: string;
  name: string;
  target_date: string | null;
}

async function fetchMemberProjectIds(userId: string): Promise<string[]> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/project_members?user_id=eq.${userId}&select=project_id`,
    { headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}` } },
  );
  if (!res.ok) throw new Error(`Membership lookup failed: ${res.status} ${await res.text()}`);
  const rows = (await res.json()) as { project_id: string }[];
  return rows.map((r) => r.project_id);
}

async function fetchDatedCards(projectIds: string[]): Promise<CardRow[]> {
  if (projectIds.length === 0) return [];
  const idList = projectIds.join(',');
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/cards?project_id=in.(${idList})&due_date=not.is.null&select=id,title,description,due_date,due_at,project_id`,
    { headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}` } },
  );
  if (!res.ok) throw new Error(`Card lookup failed: ${res.status} ${await res.text()}`);
  return (await res.json()) as CardRow[];
}

/** All accessible projects (name + optional milestone date) in one call — used
 * both to label card events with their project name and to emit milestone
 * events for the ones that have a target_date set. */
async function fetchProjects(projectIds: string[]): Promise<ProjectRow[]> {
  if (projectIds.length === 0) return [];
  const idList = projectIds.join(',');
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/projects?id=in.(${idList})&select=id,name,target_date`,
    { headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}` } },
  );
  if (!res.ok) throw new Error(`Project lookup failed: ${res.status} ${await res.text()}`);
  return (await res.json()) as ProjectRow[];
}

// To-do lists are personal (owned by user_id, not project-scoped) — bounded to
// a rolling window so the feed can't grow unbounded for a years-old account.
async function fetchTodoLists(userId: string, fromKey: string, toKey: string): Promise<TodoListRow[]> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/todo_lists?user_id=eq.${userId}&list_date=gte.${fromKey}&list_date=lte.${toKey}&select=id,name,list_date`,
    { headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}` } },
  );
  if (!res.ok) throw new Error(`To-do list lookup failed: ${res.status} ${await res.text()}`);
  return (await res.json()) as TodoListRow[];
}

async function fetchTodoItems(listIds: string[]): Promise<TodoItemRow[]> {
  if (listIds.length === 0) return [];
  const idList = listIds.join(',');
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/todo_items?list_id=in.(${idList})&select=list_id,text,is_done&order=position.asc`,
    { headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}` } },
  );
  if (!res.ok) throw new Error(`To-do item lookup failed: ${res.status} ${await res.text()}`);
  return (await res.json()) as TodoItemRow[];
}

// --- ICS building ------------------------------------------------------------

/** Escapes text per RFC 5545 §3.3.11 (backslash, semicolon, comma, newline). */
function icsEscape(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/** Folds a content line at 75 octets with a leading space continuation, as
 * RFC 5545 §3.1 requires — most clients tolerate long lines, but some
 * (notably older Outlook builds) truncate or reject them without folding. */
function foldLine(line: string): string {
  if (line.length <= 75) return line;
  const chunks: string[] = [];
  let rest = line;
  let first = true;
  while (rest.length > 0) {
    const width = first ? 75 : 74; // continuation lines lose 1 char to the leading space
    chunks.push(rest.slice(0, width));
    rest = rest.slice(width);
    first = false;
  }
  return chunks.join('\r\n ');
}

function dateStamp(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

/** YYYY-MM-DD → YYYYMMDD (the DTSTART;VALUE=DATE form for all-day events). */
function dateKeyToIcs(key: string): string {
  return key.replace(/-/g, '');
}

function buildIcs(
  cards: CardRow[],
  projectNameById: Map<string, string>,
  projects: ProjectRow[],
  lists: TodoListRow[],
  itemsByList: Map<string, TodoItemRow[]>,
): string {
  const now = dateStamp(new Date());
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Aurora//Calendar Feed//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Aurora',
    'X-WR-CALDESC:Due dates, to-dos, and milestones from Aurora',
    // Hints to clients how often to re-poll — most respect this loosely.
    'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
    'X-PUBLISHED-TTL:PT1H',
  ];

  for (const card of cards) {
    const projectName = projectNameById.get(card.project_id);
    const summary = projectName ? `${card.title} (${projectName})` : card.title;
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:card-${card.id}@aurora.app`);
    lines.push(`DTSTAMP:${now}`);
    if (card.due_at) {
      const dt = new Date(card.due_at);
      lines.push(`DTSTART:${dateStamp(dt)}`);
    } else if (card.due_date) {
      lines.push(`DTSTART;VALUE=DATE:${dateKeyToIcs(card.due_date)}`);
    }
    lines.push(foldLine(`SUMMARY:${icsEscape(summary)}`));
    if (card.description) {
      lines.push(foldLine(`DESCRIPTION:${icsEscape(card.description)}`));
    }
    lines.push('CATEGORIES:Aurora Card');
    lines.push('END:VEVENT');
  }

  for (const project of projects) {
    if (!project.target_date) continue;
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:milestone-${project.id}@aurora.app`);
    lines.push(`DTSTAMP:${now}`);
    lines.push(`DTSTART;VALUE=DATE:${dateKeyToIcs(project.target_date)}`);
    lines.push(foldLine(`SUMMARY:${icsEscape(`${project.name} — milestone`)}`));
    lines.push('CATEGORIES:Aurora Milestone');
    lines.push('END:VEVENT');
  }

  for (const list of lists) {
    const items = itemsByList.get(list.id) ?? [];
    const total = items.length;
    const done = items.filter((i) => i.is_done).length;
    const summary = total > 0 ? `${list.name} (${done}/${total})` : list.name;
    const description = items.map((i) => `${i.is_done ? '[x]' : '[ ]'} ${i.text}`).join('\n');
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:todolist-${list.id}@aurora.app`);
    lines.push(`DTSTAMP:${now}`);
    lines.push(`DTSTART;VALUE=DATE:${dateKeyToIcs(list.list_date)}`);
    lines.push(foldLine(`SUMMARY:${icsEscape(`To-do: ${summary}`)}`));
    if (description) {
      lines.push(foldLine(`DESCRIPTION:${icsEscape(description)}`));
    }
    lines.push('CATEGORIES:Aurora To-Do');
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
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

    const profile = await findProfileByToken(token);
    if (!profile || !isProOrAbove(profile.plan)) return notFound();

    const projectIds = await fetchMemberProjectIds(profile.id);

    // A year back to two years forward — generous enough for "everything
    // relevant" without letting a long-lived account's feed grow unbounded.
    const today = new Date();
    const from = new Date(today);
    from.setFullYear(from.getFullYear() - 1);
    const to = new Date(today);
    to.setFullYear(to.getFullYear() + 2);
    const fromKey = from.toISOString().slice(0, 10);
    const toKey = to.toISOString().slice(0, 10);

    const [cards, projects, lists] = await Promise.all([
      fetchDatedCards(projectIds),
      fetchProjects(projectIds),
      fetchTodoLists(profile.id, fromKey, toKey),
    ]);
    const items = await fetchTodoItems(lists.map((l) => l.id));

    const projectNameById = new Map(projects.map((p) => [p.id, p.name]));
    const milestoneProjects = projects.filter((p) => p.target_date !== null);

    const itemsByList = new Map<string, TodoItemRow[]>();
    for (const item of items) {
      const bucket = itemsByList.get(item.list_id);
      if (bucket) bucket.push(item);
      else itemsByList.set(item.list_id, [item]);
    }

    const ics = buildIcs(cards, projectNameById, milestoneProjects, lists, itemsByList);

    return new Response(ics, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'inline; filename="aurora.ics"',
        'Cache-Control': 'public, max-age=900', // 15 min — polled feeds don't need to be live-live
      },
    });
  } catch (err) {
    console.error(err);
    return new Response('Something went wrong.', { status: 500, headers: corsHeaders });
  }
});
