-- Migration: sync theme (Day/Night) + personalization (font pairing + custom
-- colors) preferences to the account, so a signed-in user's choice follows
-- them across devices instead of living only in localStorage.
-- See memory.md decision log (2026-08-15) and src/lib/theme.ts /
-- src/lib/customTheme.ts for the exact shapes these columns mirror.
--
-- Both columns are nullable, and null carries meaning: "never synced from an
-- authenticated session" — the client keeps using its localStorage cache in
-- that case instead of a server value overwriting a local/OS-derived default
-- that was never actually an explicit choice. Once a signed-in user changes
-- either preference, the client writes a concrete value here (see
-- useUpdateProfile), including on "reset to default", so from then on this
-- column is always this account's actual last choice.
--
-- RLS is row-level, not column-level: the existing "Profiles: select own" /
-- "Profiles: update own" policies (20260618093000_profiles.sql) already cover
-- these new columns on the same row — no policy change needed. Neither column
-- is in protect_plan_columns' blocklist (20260622120000_dodo_billing.sql), so
-- a normal authenticated `update` from the browser works as-is.

alter table public.profiles
  add column if not exists theme text null,
  add column if not exists custom_theme jsonb null;

alter table public.profiles drop constraint if exists profiles_theme_check;
alter table public.profiles add constraint profiles_theme_check
  check (theme is null or theme in ('dark', 'light'));

comment on column public.profiles.theme is
  'Synced Day/Night theme choice (''dark''|''light''), mirrors lib/theme.ts Theme. Null = not yet synced from an authenticated session; client falls back to its localStorage cache.';

comment on column public.profiles.custom_theme is
  'Synced personalization settings (font pairing + custom colors), mirrors lib/customTheme.ts CustomThemeSettings as JSON. Null = not yet synced; client falls back to its localStorage cache.';
