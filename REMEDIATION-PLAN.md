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

## Phase 1 — Aurora brand & logo
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

## Phase 2 — Resilience safety net *(do before the big refactors)*
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

## Phase 6 — Security hardening
**Goal:** close the low/defense-in-depth findings and add *assurance* (the security posture is already strong — see audit §3).

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
