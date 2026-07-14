# Database security tests (pgTAP)

Automated **RLS regression tests** — the "Assurance" half of Remediation Phase 6
(`REMEDIATION-PLAN.md`, from `AUDIT-nvexis.md` §3). They prove the multi-tenant
isolation guarantees hold, so a future migration can't quietly loosen them
without failing CI.

## What's covered

`rls_regression.test.sql` asserts, against a freshly-migrated database:

- **Tenant isolation** — a non-member can neither read nor write another
  tenant's `projects`, `cards`, `columns`, `labels`, or another user's
  `folders` / `todo_lists`.
- **Role-aware writes** — a `viewer` member can read a project's content but
  cannot insert into it.
- **Billing boundary** — a user cannot self-set `profiles.plan` (the
  `protect_plan_columns` trigger raises), while non-billing profile edits still
  work.
- **Positive controls** — an owner can read and write their own project.

The harness is [pgTAP](https://pgtap.org/); tests run inside a rolled-back
transaction and seed real `auth.users` rows, so they leave no residue.

## Running locally

Requires the Supabase CLI (and Docker for the local stack):

```bash
supabase start          # boots Postgres and applies every migration
supabase test db        # runs all supabase/tests/*.test.sql via pgTAP
```

> The app itself runs Docker-free (see `plan.md`); Docker is only needed for
> this local database test harness. In CI the same command runs on the
> Supabase-provided stack — see `.github/workflows/rls-tests.yml`.

## Before go-live

These tests are internal assurance, not a substitute for an **external
penetration test**. Commission one independent pen-test before the public
launch (tracked in `REMEDIATION-PLAN.md` → Phase 7).
