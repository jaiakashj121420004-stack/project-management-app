-- Regression test for the 2026-08-16 pre-pentest hardening fix
-- (20260816130000_fix_insert_trigger_ownership_oracle.sql).
--
-- Proves that spoofing another user's id on an INSERT into public.projects or
-- public.todo_recurrences no longer distinguishes that user's plan/usage via
-- the error message — every spoofed insert now fails with the SAME generic
-- RLS-violation, regardless of the target's actual plan or existing row
-- count.

begin;
create extension if not exists pgtap;

select plan(4);

create or replace function p_oracle_create_user(p_email text) returns uuid
language plpgsql as $$
declare
  v_id uuid := gen_random_uuid();
begin
  insert into auth.users (
    instance_id, id, aud, role, email,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data, is_super_admin,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values (
    '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', p_email,
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, false,
    '', '', '', ''
  );
  return v_id;
end;
$$;

create or replace function p_oracle_login(p_uid uuid) returns void
language plpgsql as $$
declare
  v_email text;
begin
  select email into v_email from auth.users where id = p_uid;
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', p_uid::text, 'role', 'authenticated', 'email', v_email)::text,
    true
  );
  perform set_config('role', 'authenticated', true);
end;
$$;

-- Target: a Free-plan user already at the 3-project cap, so the OLD trigger
-- code would have raised the distinguishing 'PROJECT_LIMIT_REACHED' error the
-- instant an attacker spoofed owner_id = target on an insert.
do $$
declare
  v_target  uuid := p_oracle_create_user('target@oracle.test');
  v_attacker uuid := p_oracle_create_user('attacker@oracle.test');
begin
  insert into public.projects (owner_id, name, accent) values (v_target, 'T1', 'aurora');
  insert into public.projects (owner_id, name, accent) values (v_target, 'T2', 'aurora');
  insert into public.projects (owner_id, name, accent) values (v_target, 'T3', 'aurora');
  perform set_config('p_oracle.target', v_target::text, false);
  perform set_config('p_oracle.attacker', v_attacker::text, false);
end;
$$;

select p_oracle_login(current_setting('p_oracle.attacker')::uuid);

-- Before the fix this raised 'PROJECT_LIMIT_REACHED' (leaking that the target
-- is Free + at their cap). Now it must fail with the plain RLS violation only
-- — same error an attacker gets for ANY spoofed owner_id, cap or no cap.
select throws_like(
  $$ insert into public.projects (owner_id, name, accent)
     values (current_setting('p_oracle.target')::uuid, 'hax', 'aurora') $$,
  '%row-level security%',
  'spoofed projects insert fails with the generic RLS error, not PROJECT_LIMIT_REACHED');

-- Same probe against todo_recurrences with a non-daily rule (the branch that
-- used to leak RECURRENCE_REQUIRES_PRO for a Free target).
select throws_like(
  $$ insert into public.todo_recurrences (user_id, name, rule)
     values (current_setting('p_oracle.target')::uuid, 'hax', '{"type":"weekly","weekdays":[1]}'::jsonb) $$,
  '%row-level security%',
  'spoofed todo_recurrences insert fails with the generic RLS error, not RECURRENCE_REQUIRES_PRO');

reset role;

-- Positive controls: the fix must not have broken real self-inserts.
select p_oracle_login(current_setting('p_oracle.attacker')::uuid);

select lives_ok(
  $$ insert into public.projects (owner_id, name, accent)
     values (current_setting('p_oracle.attacker')::uuid, 'Mine', 'aurora') $$,
  'a real self-insert into projects still works after the fix');

select lives_ok(
  $$ insert into public.todo_recurrences (user_id, name, rule)
     values (current_setting('p_oracle.attacker')::uuid, 'Mine', '{"type":"daily"}'::jsonb) $$,
  'a real self-insert into todo_recurrences (daily, free-tier-legal) still works after the fix');

reset role;

select * from finish();
rollback;
