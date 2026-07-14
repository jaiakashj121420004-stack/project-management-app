#!/usr/bin/env node
/**
 * check-db-types.mjs — generate the Supabase types and fail on drift.
 *
 * The app's typed data layer is mirrored by `src/types/database.generated.ts`,
 * produced by the Supabase CLI from the live schema (which is itself defined by
 * `supabase/migrations/*`). This script regenerates that mirror and compares it
 * to the committed copy so CI fails the moment a migration lands without the
 * types being regenerated — the "drift check" from the remediation plan.
 *
 * Modes:
 *   node scripts/check-db-types.mjs           # check: exit 1 on drift
 *   node scripts/check-db-types.mjs --write   # regenerate the committed file
 *
 * Schema source (first that resolves):
 *   --local (arg) or SUPABASE_DB_LOCAL=1   → `supabase gen types --local`
 *   SUPABASE_PROJECT_ID                    → `supabase gen types --project-id …`
 *
 * If neither is configured the script SKIPS with exit 0, so the check is a no-op
 * on a fork/CI without Supabase credentials rather than a red build. Configure a
 * project id (or run against a local DB) to turn it on.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(here, '../src/types/database.generated.ts');
const write = process.argv.includes('--write');
const local = process.argv.includes('--local') || process.env.SUPABASE_DB_LOCAL === '1';
const projectId = process.env.SUPABASE_PROJECT_ID?.trim();

if (!local && !projectId) {
  console.log(
    '[db-types] Skipped — set SUPABASE_PROJECT_ID (or pass --local) to enable the drift check.',
  );
  process.exit(0);
}

const genArgs = ['supabase', 'gen', 'types', 'typescript'];
if (local) genArgs.push('--local');
else genArgs.push('--project-id', projectId);

let generated;
try {
  generated = execFileSync('npx', genArgs, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
} catch (error) {
  console.error('[db-types] Failed to run the Supabase CLI. Is it installed and authenticated?');
  console.error(error.message);
  process.exit(1);
}

if (write) {
  writeFileSync(OUT, generated);
  console.log(`[db-types] Wrote ${OUT}`);
  process.exit(0);
}

const committed = existsSync(OUT) ? readFileSync(OUT, 'utf8') : '';
if (committed !== generated) {
  console.error(
    '[db-types] DRIFT: src/types/database.generated.ts is out of date with the schema.\n' +
      '           Run `npm run db:types` and commit the result.',
  );
  process.exit(1);
}
console.log('[db-types] OK — generated types match the schema.');
