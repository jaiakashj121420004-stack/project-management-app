-- Aurora — Calendar subscribe feed (ICS) token (Pro).
--
-- A private, unguessable token that identifies a user to the public
-- `calendar-feed` edge function without a Supabase session — calendar apps
-- (Google Calendar, Apple Calendar, Outlook) poll a plain URL, they can't send
-- an Authorization header. The token is opaque and rotatable; leaking it only
-- exposes read-only due dates/milestones, never write access.
--
-- Only the service role may set this column (mirrors protect_plan_columns() in
-- 20260622120000_dodo_billing.sql) — it is generated exclusively by the
-- calendar-feed-token edge function, never written directly by the client.

alter table public.profiles
  add column if not exists calendar_feed_token uuid null unique;

comment on column public.profiles.calendar_feed_token is
  'Opaque token for the public ICS calendar subscribe feed (Pro). Set only by the calendar-feed-token edge function.';

create or replace function public.protect_calendar_feed_token()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    if new.calendar_feed_token is distinct from old.calendar_feed_token then
      raise exception 'The calendar feed token can only be changed by the calendar feed system.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_calendar_feed_token on public.profiles;
create trigger protect_calendar_feed_token
  before update on public.profiles
  for each row
  execute function public.protect_calendar_feed_token();
