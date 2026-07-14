# Aurora — Remediation & Build Plan (from `AUDIT-nvexis.md`)

*A sequenced, phase-by-phase plan to take Aurora from ~8/10 to 9.5+ across design, engineering, and security. Every fix in the audit is assigned to a phase below. Read `AUDIT-nvexis.md` first for the reasoning behind each item.*

## Locked decisions (2026-07-14)
- **Brand model.** **Nvexis = the company. Aurora = the product** (this app). Aurora is the hero everywhere in-app; Nvexis appears only as quiet attribution (footer, legal, "by Nvexis").
- **Logo.** New **Aurora** product logo = a **refined Fraunces-based "A" monogram**. Replaces the Nvexis prism currently used as the app mark + favicons/PWA icons.
- **Scope.** Full audit — design/brand → engineering → security, in that order.

> **Audit correction folded in:** because Aurora *is* the product, most "Aurora" strings the audit flagged as "brand drift" are **correct and stay** (`index.html` title, PWA name, `package.json` name). The real brand work is narrow: (a) new Aurora "A" logo replacing the Nvexis prism icon set, (b) fix the banned gradient wordmark, (c) retire the leftover **"Lodestar"** name, (d) add subtle Nvexis attribution.

## Working conventions (apply to every phase — from `CLAUDE.md`)
- TypeScript strict, no `any`, Zod on all input, small focused files, mobile + desktop verified.
- **Each phase ends** with `npm run typecheck && npm run lint && npm run build` green, a `memory.md` state update, and a Conventional-Commit. Ship phases as independent, revertable units.
- Gate every new heavy animation behind `prefers-reduced-motion`. RLS/security stay dual-enforced (client + DB).

## Phase map

| # | Phase | Theme | Size | Depends on |
|---|---|---|---|---|
| 1 | **Aurora brand & logo** | Design | M | — |
| 2 | **Resilience safety net** | Eng (P0) | M | — |
| 3 | **Accessibility & design-system** | Design (P0) | L | 2 |
| 4 | **Design polish & marketing** | Design (P1–P2) | M | 1, 3 |
| 5 | **Engineering hardening** | Eng (P1–P2) | L | 2 |
| 6 | **Security hardening** | Security | M | 2 |
| 7 | **Verification & go-live** | QA | M | all |

Phases 1 and 2 are independent and can run in parallel. 3 depends on 2 (tests + toast infra protect the refactor). 4 depends on the logo (1) and the a11y tokens (3).

---

## Phase 1 — Aurora brand & logo  ✅ BUILT 2026-07-14 (build + commit on Windows)
> **Delivered:** chosen concept **A — Almanac** (serif A in an oxblood tile). Outlined-vector assets `public/brand/aurora-{mark,mark-night,fullbleed,glyph}.svg`; regenerated `favicon-64`/`pwa-192`/`pwa-512`/`apple-touch-icon`/`maskable-512` + `favicon.svg` via CairoSVG; deleted old `nvexis-*.png`. `Brand.tsx` → inline `AuroraMark` + solid `text-ox` wordmark (dropped `gradient-text`); `LandingPage.tsx` mark swapped; "Lodestar" retired (`/lodestar`→`/preview`); "· by Nvexis" in the sidebar footer; `index.html` + `generate-icons.mjs` docs updated. ⚠️ Not built/committed in-session (mount truncation) — do `npm run build` + commit on Windows.

**Goal:** a distinct, beautiful Aurora identity; retire the Nvexis prism as the *product* mark and the "Lodestar" name; establish product-led hierarchy with quiet Nvexis attribution.

**Decision point (early in phase):** I produce **3 SVG "A" monogram concepts** (Fraunces-derived, oxblood-on-parchment, tested at 16 px favicon → 512 px PWA) → you pick one → I finalize. Everything below flows from the chosen mark.

**Tasks**
- Design the Aurora **A** monogram as scalable SVG: full-color (Day + Night variants), single-color, and a favicon-simplified glyph. Source of truth in `public/brand/aurora-*.svg`.
- Rework `scripts/generate-icons.mjs` to render the Aurora "A" (not the aurora-gradient "A" or the prism) → regenerate `favicon-64.png`, `pwa-192x192.png`, `pwa-512x512.png`, `maskable-512x512.png`, `apple-touch-icon.png`, and `public/favicon.svg`.
- `src/components/shell/Brand.tsx`: swap `nvexis-mark-transparent-800.png` → new Aurora mark; **remove the banned `gradient-text`** on the wordmark → solid oxblood (`text-ox`), per one-accent rule.
- `index.html`: update the `mask-icon`/icon comments (color already `#7A2A26` ✓); confirm title/description stay "Aurora".
- **Retire "Lodestar":** rename the `/lodestar` route (App.tsx) to a neutral `/preview` (or fold into `/`); purge user-facing "Lodestar" strings in `src/features/marketing/**` (keep the internal folder name if convenient, but no user-visible "Lodestar").
- **Nvexis attribution:** `Sidebar.tsx` footer "Aurora · v0.1" → "Aurora · v0.1 · by Nvexis"; add "© Nvexis" to marketing + legal footers only.
- Delete the now-unused `public/brand/nvexis-*.png` once nothing references them.

**New deps:** none.
**Acceptance:** installed PWA + browser tab + sidebar all show the Aurora "A"; no "Lodestar" visible anywhere; no gradient on the wordmark; icons crisp at 16–512 px; light + dark both correct.
**Verify:** build, install PWA on a phone, screenshot the home-screen icon + splash; grep confirms zero user-facing "Lodestar".
**Commit:** `feat(brand): new Aurora A-monogram logo, retire Lodestar, add Nvexis attribution`

---

## Phase 2 — Resilience safety net *(do before the big refactors)*  ✅ BUILT 2026-07-14 (`npm install` + build/test + commit on Windows)
> **Delivered:** root error boundaries — extended `ErrorBoundary` (`onReset` + `resetKeys`) + new `RouteErrorBoundary` (pairs `QueryErrorResetBoundary`) wrapping the authenticated `<Outlet/>` (`AppShell`) and every lazy `<Suspense>` (project canvas, Library `OpenCanvas`, `CanvasHome`, `NoteEditor`). Visible mutation failures — a global `MutationCache({ onError })` in `lib/queryClient.ts` (+ typed `Register.mutationMeta` opt-outs) firing a **custom** toast (`components/feedback/{toast.ts,Toaster.tsx}`, no `sonner`), mounted at root in `main.tsx`. Test harness — Vitest 4 + testing-library + jsdom + coverage-v8, `test`/`test:ci`/`coverage` scripts, `vitest.config.ts`, `src/test/setup.ts`, ESLint test override; 5 pure-logic suites (`board/ordering`, `lib/dueAt`, `editor/serialize`, `library/tree`, `canvas/collab/yCanvasDoc`). CI — `.github/workflows/ci.yml` runs `typecheck && lint && test:ci && build`. ⚠️ New **dev** deps require `npm install`; not built/tested in-session (mount truncation) — run the gate + commit on Windows. See `memory.md`.

**Goal:** make every later change safe to ship — catch crashes, surface failures, and prove correctness with tests.

**Tasks**
- **Root error boundary.** Reuse the existing `src/components/feedback/ErrorBoundary.tsx` (it's good, just barely used). Wrap the authenticated shell (`AppShell.tsx` around `<Outlet/>`) and each lazy `<Suspense>` (canvas editor, note editor, project page). Pair with React Query's `QueryErrorResetBoundary` so "Try again" refetches.
- **Visible mutation failures.** Add a global `MutationCache({ onError })` in `src/lib/queryClient.ts` + a lightweight toast (`sonner`, ~3 kB, or a ~60-line custom `Toaster`). Every silent `onError` rollback (all ~14 hooks, e.g. `board/useBoard.ts`) now shows "Couldn't save — retrying" style feedback.
- **Test harness.** Add **Vitest** + `@testing-library/react` + `jsdom` + `@vitest/coverage-v8`; `test` / `test:ci` / `coverage` scripts.
- **First tests** (pure logic, already perfectly testable): `board/ordering.ts` (midpoint + collision), `lib/dueAt.ts` (timezone/`combineDueAt`), `features/editor/serialize.ts` (`renderBlockHtml` escaping, `markdownToDoc`), `library/tree.ts` (`descendantIds`), `canvas/collab/yCanvasDoc.ts` (`applySceneDiff` dedup).
- **CI.** GitHub Actions workflow: `typecheck && lint && test:ci && build` on every push/PR.

**New deps:** `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`, `@vitest/coverage-v8`, `sonner` (or none if custom toast).
**Acceptance:** a thrown error in any route shows the fallback (not a white screen); a forced mutation failure shows a toast; `npm run test:ci` passes in CI; coverage reported on the pure-logic modules.
**Verify:** temporarily throw in a component + reject a mutation to see boundary + toast; CI green on a draft PR.
**Commit:** `feat(resilience): root error boundaries, mutation-error toasts, Vitest + CI`

---

## Phase 3 — Accessibility & design-system
**Status: ✅ BUILT (2026-07-14) — pending build/test + commit on Windows (see memory.md).** All six task groups done: AA contrast (new `lib/contrast.ts` + per-theme label/priority/status tokens), `useFocusTrap` (Modal/CommandPalette/mobile drawer + Modal `aria-labelledby`/`describedby`), `<MotionConfig reducedMotion="user">` + Spinner opacity-pulse + Reveal comment, skip link, GlassSelect listbox + CommandPalette `aria-activedescendant`, radius consolidation (3xl/4xl → 2xl) + StyleGuide "Inter"→"Spectral". Tests: `contrast.test.ts` + `useFocusTrap.test.tsx`.

**Goal:** clear the audit's accessibility red flags and tighten the token system. This is the largest design phase.

**Tasks**
- **Contrast (WCAG AA).** `src/lib/labelColors.ts` + `LabelPill.tsx`: stop rendering the saturated swatch hex as *text*; introduce a darkened per-theme text token (readable on the 16% tint) or a solid readable foreground. Same for `src/lib/priority.ts` (`#f97316`, `#3b82f6`). Make `success`/`info` in `tailwind.config.ts` theme-reactive CSS vars (they're fixed hex and fail on dark). Target ≥ 4.5:1 for all pill/badge text in **both** themes.
- **Focus management.** Add a small `useFocusTrap` hook (trap + restore focus to trigger on close; `Esc` to close). Apply to `src/components/Modal.tsx`, `src/features/command-palette/*`, and the `Sidebar.tsx` mobile drawer. Wire `aria-labelledby`/`aria-describedby` to the visible heading in `Modal.tsx` (currently only `aria-label={title}`, empty when untitled).
- **Reduced motion.** Wrap the app in `<MotionConfig reducedMotion="user">` (`src/main.tsx`) so Framer mount animations (`Reveal`, `Modal`, `GlassSelect`, `ThemeToggle`) honor the preference. Give the CSS `animate-spin` `Spinner` an opacity-pulse fallback (the global guard currently freezes it mid-arc). Fix the false comment in `Reveal.tsx`.
- **Skip link.** Add a visually-hidden "skip to content" link targeting the existing `<main>` in `AppShell.tsx`.
- **Keyboard-complete widgets.** `src/components/forms/GlassSelect.tsx` → true listbox (arrow-key nav, type-ahead, `aria-activedescendant`). `CommandPalette` results → `aria-activedescendant` so AT announces the highlighted row.
- **Token cleanup.** Consolidate the radius scale to 2–3 named radii (currently `lg/xl/2xl/3xl/4xl` used interchangeably); fix stale `StyleGuide.tsx` copy that labels body type "Inter" (it's Spectral).

**New deps:** none (custom `useFocusTrap`; `focus-trap-react` only if preferred).
**Acceptance:** axe reports zero contrast/focus violations on the core screens; every modal traps + restores focus and closes on `Esc`; reduced-motion users get no mount animations; keyboard-only users can operate selects, the palette, and skip to content.
**Verify:** `@axe-core/react` in dev + manual keyboard-only walkthrough of board, modal, palette, drawer; contrast-check the pills in both themes.
**Commit:** `fix(a11y): AA contrast, focus traps, reduced-motion, skip link, listbox semantics`

---

## Phase 4 — Design polish & marketing
**Status: ✅ BUILT (2026-07-14) — pending build/test + commit on Windows (see memory.md).** All four task groups done. **(1) Dead search wired:** new `features/command-palette/paletteStore.ts` (module-level open-state pub/sub, mirrors `feedback/toast.ts`); `CommandPalette` now reads open-state via `useSyncExternalStore` (⌘K toggles the store); `Topbar` search button calls `openCommandPalette()` + shows a ⌘K kbd hint. Palette **broadened** beyond the 6 nav items to the user's **projects, standalone notes, personal canvases and folders** (shared TanStack caches; empty query = calm nav list, typing searches everything, capped at 40). `LibraryPage` gained `?note=<id>` + `?folder=<id>` deep-links (canvas already had `?canvas=`) so palette results open the right thing. **(2) Accent restraint:** `Avatar.tsx` no longer hashes across six accent *families* (oxblood+pine+gilt+umber…) — it uses a single **oxblood-family tonal ramp**, so an avatar cluster stays "one chroma in the room." Per-project accents (already earthy) and *semantic* colour (labels/priority/status/due/cursors) are intentionally left — they're meaning, not decoration. **(3) Guidelines reconciled:** `DESIGN-GUIDELINES.md` bumped to **v5.0** — new **§0 "Two canonical surfaces"** (A = flat editorial print/social, B = the app's glass-over-parchment) + a full **§11** documenting the real app system (warm glass, paper-grain, single-family accent tiles, motion gated by reduced-motion, the accent-restraint law, AA tokens, consolidated radius). Every blanket "no glass/gradient/glow" ban is now scoped to Surface A, so the doc stops contradicting the product. **(4) Marketing voice + trust:** `LandingPage.tsx` de-hyped ("jaw-dropping" → "one calm workspace"; the fabricated **Priya/Marco/Dana** testimonials — incl. "feels like magic" — replaced by an honest **maker's note** that admits the product is new); `MarketingFooter` tagline de-hyped + a dead `#showcase` link fixed; "Most loved" chip → honest "Best value". Contrast fixed to AA (reusing `lib/contrast.ts` maths): hero caption `0.45`→`0.72`, `opacity-50` footer strings → `0.72`, parchment eyebrows off failing `--lode-gold-deep` (#b8902f, 2.4:1) onto a new `--lode-oxblood-deep` (#7a2a26, 7.6:1), PlanCard period `0.5`→`0.72`. **Tests:** `command-palette/paletteStore.test.ts` (open/close/toggle/subscribe/idempotent/unsubscribe) + `marketing/marketingContrast.test.ts` (proves every fixed token ≥ AA and that the old gold-deep genuinely failed). **No new deps.** A review subagent type-checked all changed files (clean). ⚠️ Not built/committed in-session (mount truncation) — run the gate + commit on Windows.

**Goal:** the last 10% of craft — visual restraint, honest marketing, and dead-affordance cleanup.

**Tasks**
- **Wire the dead search.** `src/components/shell/Topbar.tsx`: the "Search projects, cards, notes…" button has no handler → open the command palette on click (and focus it). Optionally broaden palette results beyond the 6 nav items to match the "find any note, canvas, or folder" promise.
- **Accent restraint.** Constrain to a single accent family per surface (audit: a card can show oxblood + cyan + orange + blue at once). Reduce gradient tiles/avatars/badges to the oxblood accent; keep per-project accents subtle.
- **Reconcile the brand bible.** `DESIGN-GUIDELINES.md` bans the glass/gradient/motion system the app is built on. Rewrite it to describe the *actual* "glass-over-parchment" system as the source of truth (or explicitly document the deviations), so the doc stops contradicting the product.
- **Marketing voice + trust.** `LandingPage.tsx`: de-hype copy ("feels like magic", "jaw-dropping") toward the stated honest/anti-guru voice; **replace the fabricated testimonials** (Priya/Marco/Dana) with real or clearly-illustrative ones; fix low-contrast captions (`rgba(236,228,214,0.45)`, `opacity-50` footer strings) to AA.

**New deps:** none.
**Acceptance:** search opens the palette; no surface shows >1 accent family; guidelines match the shipped system; no fabricated social proof; marketing text passes AA.
**Verify:** click-through of the marketing site + app chrome; contrast pass on marketing.
**Commit:** `feat(design): wire search, accent restraint, honest marketing, reconcile guidelines`

---

## Phase 5 — Engineering hardening
**Status: ✅ BUILT (2026-07-14) — pending build/test + commit on Windows + 1 new dep + 1 migration (see memory.md).** All six eng items + the custom-templates feature done. **(1) Ordering robustness:** `board/ordering.ts` — `byPosition` now breaks ties by `created_at` then `id` (so concurrent midpoint moves render in one deterministic order, never render-to-render flicker) + `needsRebalance`/`rebalancedPositions` helpers (renumber a list to clean STEP multiples once any gap collapses toward the float-precision floor), wired into the card-move path in `Board.tsx` (self-healing burst of writes, moved card written once with its rebalanced position). Tests added. **(2) Render perf:** `BoardCard`, `CardSurface`, calendar `DayCell` wrapped in `React.memo`; made effective by a stable `onOpenCard` (`useCallback` in `Board.tsx`, threaded through `BoardColumn`) + memoised `face` + a stable `NO_CARDS` empty-array ref in `CalendarGrid` — so the board's many `useCallback`s finally pay off. **(3) Bundle splitting:** `vite.config.ts` Rollup `manualChunks` (vendor / **editor**=Tiptap+ProseMirror+Yjs / **canvas**=Konva+perfect-freehand) + `rollup-plugin-visualizer` (emits `dist/stats.html`); PWA precache cap lowered 4 MB → 2 MB. **(4) DB types + drift:** `scripts/check-db-types.mjs` (`supabase gen types` → `src/types/database.generated.ts`, diff-on-drift, self-skips without `SUPABASE_PROJECT_ID`) + `db:types`/`db:types:check` npm scripts + a **separate** `.github/workflows/db-types.yml` (secret-guarded, off the main gate). *Judgment call:* the hand-maintained `types/database.ts` was **kept** (it carries app-type aliases — `AccentName`/`PlanId`/etc. — a raw generation would drop, and the CLI can't run in-session); the `note_templates` table was added to it by hand (item 4's stated fallback). Full cutover to generated types is a fast-follow once a project ref is linked. **(5) Fetch/dedup:** global `staleTime: 30_000` in `queryClient.ts` (kills the write→refetch×3); **one generic `useOptimisticMutation`** (`src/lib/`) now backs `useBoard`/`useNotes`/`useLibrary`(folders+notes)/`useNoteTemplates` — the 4 near-verbatim factories are thin adapters; `useInfiniteQuery` added for the **project activity feed** (`useProjectActivityInfinite` + keyset-paged `fetchProjectActivityPage` + "Load older" in `ActivityFeed`). *Scope note:* notifications + comments were **left as capped queries** — converting those (optimistic writes + realtime echo + unread counts) blind, with no runtime test, risked regressing the app's most delicate paths; activity (append-only, read-only) proves the pattern safely. **(6) Two nits:** `useCanvas.ts` seed `scene: {}` → `{ elements: [] }`; `CanvasEditor.tsx` gained a `beforeunload` + `visibilitychange`→hidden flush (persists a last peer's in-flight Yjs ops). **(7) NEW — custom note templates:** migration `20260714220000_note_templates.sql` (owner-only RLS + `SECURITY DEFINER` before-write trigger stamping/immutabilising `owner_id` + `updated_at`, like `folders`); `note_templates` added to `types/database.ts` (+`NoteTemplateRow`); data layer `templates.api.ts` + optimistic `useNoteTemplates` (cache `['note-templates', userId]`) + Zod `templateSchemas.ts` (title required; `content_json` validated against the real `blockExtensions` schema via `getSchema().nodeFromJSON().check()`); `TemplatesMenu.tsx` (bookmark button on standalone-note headers → "Save as template" via `NameDialog`, + a small rename/delete manager, one modal at a time); the slash menu now renders built-ins **+** the user's custom templates from one merged list (`allSlashItems`) under a distinct **"Your templates"** section (bookmark glyph), fed by a module-level snapshot (`customTemplateStore`) kept in sync by `useSyncCustomTemplates` mounted in `NoteEditor`. Free feature, mobile+desktop, AA. **Tests:** `ordering` (tiebreaker + rebalance), `useOptimisticMutation` (patch/reconcile/rollback), `templateDoc` (doc→blocks + subtitle), `slashItems` (merge/ordering/keys/filter/insert). **Deps:** `rollup-plugin-visualizer` (dev) → needs `npm install`. **⚠️ Mount caveat (unchanged):** all edits + verified via **host** file tools (a review subagent statically type-checked every changed file — clean); the in-session Linux mount serves truncated reads, so **run `npm install` → `npm run typecheck && npm run lint && npm run test:ci && npm run build` → commit on Windows**, and apply the `note_templates` migration in the Supabase SQL Editor.

**Goal:** correctness and performance items that need the Phase 2 test net under them.

**Tasks**
- **Ordering robustness.** `src/features/board/ordering.ts`: add a stable tiebreaker (`position`, then `created_at`/`id`) so concurrent midpoint moves can't render in arbitrary order; add a periodic renumber/rebalance (or migrate to LexoRank-style fractional string keys). Cover with tests from Phase 2.
- **Render performance.** Wrap board/calendar leaves (`BoardCard`/`CardSurface`/calendar `DayCell`) in `React.memo` — or enable the **React 19 compiler** (`babel-plugin-react-compiler`) and measure. The 54 `useCallback`s are largely wasted today because children aren't memoized.
- **Bundle splitting.** `vite.config.ts`: add Rollup `manualChunks` (vendor / editor(Tiptap) / canvas(Konva)); add `rollup-plugin-visualizer`; lower the 4 MB PWA precache cap back down once split.
- **DB type generation.** Replace the hand-maintained 1,049-line `src/types/database.ts` with `supabase gen types typescript`; add a CI check that fails on drift from `supabase/migrations/*`.
- **Fetching + dedup.** Give board/list queries a small `staleTime` in `queryClient.ts` (cut the double-refetch from `staleTime:0` + `onSettled` + realtime echo); add `useInfiniteQuery` for unbounded lists (activity log, notifications, comments); extract the duplicated optimistic-mutation factories (`useBoardMutation`/`useFoldersMutation`/`useLibraryNotesMutation`) into one generic `useOptimisticMutation`.
- **Two correctness nits.** Fix the invalid optimistic cast in `canvas/useCanvas.ts:148` (`scene:{}` isn't a valid `CanvasScene` — use `{elements:[]}`); add a `beforeunload`/`visibilitychange` flush to `CanvasEditor.tsx` so in-flight Yjs ops persist if the last peer leaves.

**New deps (optional):** `babel-plugin-react-compiler`, `rollup-plugin-visualizer`.
**Acceptance:** ordering tests pass under simulated concurrency; board re-render count drops measurably; main chunk meaningfully smaller; `database.ts` generated + drift-checked; one write no longer triggers two refetches.
**Verify:** React DevTools profiler before/after; bundle-visualizer diff; ordering + reconciler tests green.
**Commit:** `perf/refactor(core): stable ordering, memoized leaves, split bundle, generated DB types`

---

## Phase 6 — Security hardening  ✅ BUILT (2026-07-14) — ⚠️ npm install + build/test + commit on Windows + apply 1 migration
**Goal:** close the low/defense-in-depth findings and add *assurance* (the security posture is already strong — see audit §3).

> **Built:** enumeration oracle closed (new migration `20260714230000_sharing_hardening.sql`: `revoke execute` on `user_id_for_email` from `authenticated`/`public`; `share_canvas`/`share_note` dropped + recreated `returns void` with the email lookup inlined and a generic no-op on unknown/self email; `SharePanel` shows a neutral "if they're an Aurora user" note; `database.ts` share RPC `Returns: undefined`). Webhook hardened (product allow-list `PRO_PRODUCT_IDS` fail-closed, `business_id` required + optionally matched to `DODO_BUSINESS_ID`, `metadata.user_id` UUID-gated before the PostgREST filter). Edge fns hardened (constant-time `x-cron-secret` compare in `send-due-reminders`; CORS scoped `*`→`APP_URL` + `Vary: Origin` in `dodo-create-checkout`/`dodo-portal`; best-effort per-user in-memory rate limiting on both). Plaintext `Aurora payment api.txt` deleted (was gitignored + untracked). XSS defense-in-depth (`isomorphic-dompurify` pass over `renderBlockHtml` output in `serialize.ts`). Assurance: pgTAP RLS regression suite `supabase/tests/rls_regression.test.sql` (15 assertions: non-member read/write denial across projects/cards/columns/labels/folders/todo_lists, viewer-can't-write, user-can't-self-set-plan, owner positive controls) + `supabase/tests/README.md` + a separate `.github/workflows/rls-tests.yml` (local Supabase stack, off the main gate). New dep: `isomorphic-dompurify`. Tests: sanitize suite added to `serialize.test.ts`. Verified via a review subagent (host reads only); pending Windows build/test + commit + applying the migration. **Next: Phase 7 — Verification & go-live.**

**Tasks**
- **Enumeration oracle (Low).** `supabase/migrations/…_sharing.sql`: `revoke execute` on `user_id_for_email(text)` from `authenticated` and inline the lookup inside the `share_canvas`/`share_note` RPCs; return a generic result whether or not the email matched (don't leak account existence). New migration.
- **Webhook validation (Low).** `supabase/functions/dodo-webhook/index.ts`: validate `data.product_id ∈ {DODO_PRODUCT_PRO_MONTHLY, DODO_PRODUCT_PRO_ANNUAL}` before granting Pro; assert `event.business_id`; validate `metadata.user_id` is a UUID before building the PostgREST filter.
- **Edge-function hardening (Info).** Constant-time compare for `x-cron-secret` in `send-due-reminders`; scope CORS from `*` to `APP_URL` in `dodo-create-checkout`/`dodo-portal`; add basic per-user rate limiting on checkout/portal.
- **Secret hygiene (Info).** Delete `Aurora payment api.txt` from the working tree (it's gitignored, but a live secret shouldn't sit in the repo folder); confirm the secret is only in the Supabase dashboard.
- **XSS defense-in-depth (Info).** Add an isomorphic **DOMPurify** pass over `renderBlockHtml`'s output in `features/editor/serialize.ts` (belt-and-suspenders behind the already-hardened `SafeLink`).
- **Assurance.** Add automated **RLS regression tests** (a Supabase test that asserts a non-member is denied read/write on each table, a viewer can't write, a user can't self-set `plan`); schedule one **external penetration test** before go-live.

**New deps:** `isomorphic-dompurify`; a Supabase/pgTAP or SQL test harness for RLS.
**Acceptance:** share-by-email no longer reveals account existence; webhook grants Pro only for known products from the right business; no secret file in the tree; RLS tests prove isolation in CI.
**Verify:** run the RLS test suite; attempt a forged webhook (wrong product) → no upgrade; attempt email enumeration → generic response.
**Commit:** `fix(security): close enumeration + webhook-validation findings, add RLS regression tests`

---

## Phase 7 — Verification & go-live
**Goal:** prove the whole thing, on real devices, and update the docs.

**Tasks**
- Full **axe** + **Lighthouse** pass (target: a11y ≥ 95, PWA installable, perf budget) on desktop + mobile.
- **Mobile device pass** on a real phone: board DnD, modals/focus, canvas, install + offline (per `NVEXIS-UPGRADE-PLAN.md` §10).
- Full regression: run the Vitest suite + a manual smoke of every feature (auth, projects, board, calendar, todos, library, notes, canvas, collaboration, billing test-mode, reminders).
- **Docs:** update `memory.md` (state + done-log), `plan.md` (if architecture/design-system changed), `CLAUDE.md` design rules (Aurora logo, retire Lodestar), and rewrite `DESIGN-GUIDELINES.md` to match reality.
- Re-score against `AUDIT-nvexis.md` to confirm design / eng / security all clear 9.5.

**Acceptance:** Lighthouse + axe targets met on two form factors; suite green; docs current; re-score ≥ 9.5.
**Commit:** `chore(release): verification pass, docs sync, re-score`

---

## Effort & sequencing
- **Fastest visible win:** Phase 1 (logo) — self-contained, low-risk, high-impact; can ship first.
- **Highest leverage:** Phase 2 — unblocks safe delivery of 3, 5, 6.
- **Biggest phase:** Phase 3 (accessibility) — the bulk of the "design 9.5" work.
- **Parallelizable:** 1 ∥ 2; then 3 → 4; 5 and 6 can run alongside 3/4 once 2 lands.

## Definition of done
Design ≥ 9.5 (brand coherent, AA everywhere, focus-complete) · Engineering ≥ 9.5 (tests + CI, resilient failures, split bundle, generated types) · Security ≥ 9.5 (findings closed, RLS-tested, pen-tested). Tracked against the scores in `AUDIT-nvexis.md`.
