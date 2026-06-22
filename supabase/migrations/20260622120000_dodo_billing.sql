-- Billing — switch the payment provider from Stripe to Dodo Payments.
--
-- Stripe was never activated (no live data), so retiring its linkage is safe.
-- Dodo Payments is a Merchant of Record: it collects payment, localizes the
-- currency, and handles sales tax/VAT at checkout. As with Stripe, the ONLY
-- thing that flips a user to Pro is the verified Dodo webhook (service role);
-- the browser can never set the billing columns (a trigger forbids it).
--
-- `plan`, `plan_status`, `current_plan()` and `project_is_pro()` are unchanged.

-- 1. Replace the Stripe id columns with Dodo ones.
alter table public.profiles
  add column if not exists dodo_customer_id text,
  add column if not exists dodo_subscription_id text;

alter table public.profiles
  drop column if exists stripe_customer_id,
  drop column if exists stripe_subscription_id;

-- 2. Protect the billing columns: only the service role (the verified Dodo
--    webhook) may change plan / plan_status / dodo_*. Normal authenticated
--    users keep updating their own display name, reminder prefs, etc.
create or replace function public.protect_plan_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    if new.plan is distinct from old.plan
       or new.plan_status is distinct from old.plan_status
       or new.dodo_customer_id is distinct from old.dodo_customer_id
       or new.dodo_subscription_id is distinct from old.dodo_subscription_id then
      raise exception 'Billing fields can only be changed by the billing system.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_plan_columns on public.profiles;
create trigger protect_plan_columns
  before update on public.profiles
  for each row
  execute function public.protect_plan_columns();
