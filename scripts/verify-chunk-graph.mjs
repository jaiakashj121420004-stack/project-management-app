// scripts/verify-chunk-graph.mjs
//
// Catches the exact bug class that broke notes on 2026-08-21: a build where one
// emitted chunk statically imports another chunk filename that the SAME build
// never actually wrote to disk (a bundler chunk-splitting self-consistency bug,
// not a logic bug in application code). Vite/Rolldown normally guarantee this
// can't happen, but this repo hit it once — this script is a cheap, permanent
// safety net so a broken build fails loudly here instead of shipping and only
// showing up in the browser as "Failed to load module script ... MIME type
// text/html" on a page a user actually opens.
//
// Usage: run AFTER `npm run build`, BEFORE committing/pushing.
//   node scripts/verify-chunk-graph.mjs

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';

const assetsDir = join(process.cwd(), 'dist', 'assets');

if (!existsSync(assetsDir)) {
  console.error(`✗ ${assetsDir} does not exist — run "npm run build" first.`);
  process.exit(1);
}

const jsFiles = readdirSync(assetsDir).filter((f) => f.endsWith('.js'));
const importRe = /from\s*["']\.\/([^"']+)["']/g;

let problems = 0;
let checked = 0;

for (const file of jsFiles) {
  const full = join(assetsDir, file);
  const content = readFileSync(full, 'utf8');
  let match;
  importRe.lastIndex = 0;
  while ((match = importRe.exec(content))) {
    const referenced = match[1];
    checked++;
    const referencedPath = join(assetsDir, referenced);
    if (!existsSync(referencedPath)) {
      problems++;
      console.error(`✗ ${file} imports "./${referenced}" — that file was NOT emitted by this build.`);
    }
  }
}

if (problems > 0) {
  console.error(
    `\n${problems} broken chunk reference(s) found out of ${checked} static imports checked.\n` +
      `This build is NOT safe to deploy — a user would hit "Failed to load module script" for these.\n` +
      `Try: delete node_modules + dist, npm install, npm run build again.`,
  );
  process.exit(1);
}

console.log(`✓ Chunk graph is self-consistent — ${checked} static imports across ${jsFiles.length} JS files, all resolve.`);
