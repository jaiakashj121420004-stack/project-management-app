-- Migration: full-text search over cards + notes for the command palette
-- (Improvement Plan Task 20 — see IMPROVEMENT-PLAN-2026-08.md / memory.md).
--
-- This is the first live-DB query the command palette makes (everything else
-- filters TanStack caches already sitting in memory). Two pieces:
--
--   1. Generated `search_vector tsvector` columns on `cards` (title + the
--      `description` free-text field) and `notes` (title + `content`, the
--      plain-text mirror kept in sync by the block editor — NOT `content_json`,
--      see 20260713140000_notes_block_content.sql), each backed by a GIN index.
--      This is the standard Postgres pattern for generated search columns (see
--      the Postgres manual §12.4.3.2's own `to_tsvector('english', ...)`
--      example) — no tsvector/pg_trgm precedent exists elsewhere in this repo's
--      migrations, so this establishes the convention rather than following one.
--
--   2. `public.search_workspace(p_query, p_limit)` — a single RPC the palette
--      calls that unions ranked card + note matches. Deliberately NOT
--      SECURITY DEFINER: it is a plain SECURITY INVOKER SQL function, so
--      PostgREST executes it as the calling `authenticated` role and every
--      underlying `select` re-runs `cards`'/`notes`'/`projects`' OWN RLS
--      policies exactly as if the client queried those tables directly. That
--      means the search can never surface a row the caller couldn't otherwise
--      read — the guarantee comes from reusing the real RLS, not from a
--      hand-rolled membership check that could drift from it.
--
-- Query-as-you-type needs prefix matching (`web` should match `webhook` while
-- the user is still typing it), which plain to_tsquery/websearch_to_tsquery
-- don't do. `ts_prefix_query()` tokenizes the raw input and rebuilds it as an
-- ANDed set of `lexeme:*` prefix matches, safely quoting each token (Postgres's
-- quoted-lexeme tsquery syntax) so punctuation/apostrophes in a search box can
-- never be parsed as tsquery operators.
--
-- `ts_headline`'s StartSel/StopSel are set to empty strings so `snippet` comes
-- back as plain text with no <b>…</b> match markers — the frontend renders it
-- as ordinary React text (never dangerouslySetInnerHTML, matching the rest of
-- this codebase's markdown/search rendering), so highlighting it isn't worth
-- inventing a small parser for.

-- 1. Generated search columns + GIN indexes ----------------------------------

alter table public.cards
  add column if not exists search_vector tsvector
  generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'B')
  ) stored;

comment on column public.cards.search_vector is
  'Generated tsvector (title weight A, description weight B) for the command palette''s full-text search RPC (search_workspace). Never written directly.';

create index if not exists cards_search_vector_idx on public.cards using gin (search_vector);

alter table public.notes
  add column if not exists search_vector tsvector
  generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(content, '')), 'B')
  ) stored;

comment on column public.notes.search_vector is
  'Generated tsvector (title weight A, content weight B — the plain-text mirror, not content_json) for the command palette''s full-text search RPC (search_workspace). Never written directly.';

create index if not exists notes_search_vector_idx on public.notes using gin (search_vector);

-- 2. Prefix-tsquery helper -----------------------------------------------------
-- Turns raw user input into an ANDed prefix-match tsquery: "auth wor" ->
-- 'auth':* & 'wor':*. Quoting each token via quote_literal() uses tsquery's own
-- quoted-lexeme syntax, so a token containing '&', '|', '!', '(', ':', etc. is
-- treated as a literal word, never a query operator — safe against arbitrary
-- palette input. Empty/whitespace-only input yields an empty tsquery, which
-- matches nothing (search_workspace short-circuits on it anyway).
create or replace function public.ts_prefix_query(p_query text)
returns tsquery
language sql
stable
set search_path = ''
as $$
  select coalesce(
    to_tsquery('english', string_agg(quote_literal(word) || ':*', ' & ')),
    ''::tsquery
  )
  from regexp_split_to_table(trim(both from coalesce(p_query, '')), '\s+') as word
  where length(word) > 0;
$$;

revoke all on function public.ts_prefix_query(text) from public, anon;
grant execute on function public.ts_prefix_query(text) to authenticated;

-- 3. search_workspace RPC ------------------------------------------------------
-- Ranked union of matching cards + notes. `project_name` rides along so the
-- palette can label a result ("Card · Marketing site") without a second round
-- trip; the join is against `projects`, itself RLS-gated the same way, so it
-- can never leak a project name the caller couldn't already see. SECURITY
-- INVOKER (the default — stated explicitly here for the same reason the RLS
-- guarantee above is spelled out: this function's whole safety story rests on
-- NOT elevating privileges).
create or replace function public.search_workspace(p_query text, p_limit int default 8)
returns table (
  kind         text,
  id           uuid,
  project_id   uuid,
  project_name text,
  title        text,
  snippet      text,
  rank         real
)
language sql
stable
security invoker
set search_path = ''
as $$
  select kind, id, project_id, project_name, title, snippet, rank
  from (
    select
      'card'::text as kind,
      c.id,
      c.project_id,
      p.name as project_name,
      c.title,
      ts_headline(
        'english',
        coalesce(nullif(c.description, ''), c.title),
        public.ts_prefix_query(p_query),
        'MaxFragments=1, MaxWords=18, MinWords=6, ShortWord=3, StartSel="", StopSel=""'
      ) as snippet,
      ts_rank(c.search_vector, public.ts_prefix_query(p_query)) as rank
    from public.cards c
    left join public.projects p on p.id = c.project_id
    where length(trim(coalesce(p_query, ''))) > 0
      and c.search_vector @@ public.ts_prefix_query(p_query)

    union all

    select
      'note'::text as kind,
      n.id,
      n.project_id,
      p.name as project_name,
      n.title,
      ts_headline(
        'english',
        coalesce(nullif(n.content, ''), n.title),
        public.ts_prefix_query(p_query),
        'MaxFragments=1, MaxWords=18, MinWords=6, ShortWord=3, StartSel="", StopSel=""'
      ) as snippet,
      ts_rank(n.search_vector, public.ts_prefix_query(p_query)) as rank
    from public.notes n
    left join public.projects p on p.id = n.project_id
    where length(trim(coalesce(p_query, ''))) > 0
      and n.search_vector @@ public.ts_prefix_query(p_query)
  ) results
  order by rank desc, title asc
  limit greatest(coalesce(p_limit, 8), 0);
$$;

revoke all on function public.search_workspace(text, int) from public, anon;
grant execute on function public.search_workspace(text, int) to authenticated;

comment on function public.search_workspace(text, int) is
  'Ranked full-text search over cards + notes for the command palette. SECURITY INVOKER — relies entirely on cards/notes/projects'' own RLS policies for access control, never a hand-rolled membership check.';
