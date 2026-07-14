# Nvexis — Full Audit: Design · Engineering · Security

*Reviewed: the whole app — ~33,000 LOC of React 19 + TypeScript (strict) + Vite + Tailwind, a Supabase backend with 24 migrations and 4 Deno edge functions, Yjs-based collaborative canvas, and Dodo Payments billing. Ratings are calibrated against a shipping, paid SaaS bar — not "good for a solo project."*

## Scores at a glance

| Lens | Score | One-line |
|---|---|---|
| **Design / UX** | **7.5 / 10** | Sophisticated, coherent visual system undercut by a 3-way brand identity crisis and light-mode contrast failures. |
| **Engineering quality** | **7.5 / 10** | Elite type-safety and data-layer discipline, capped hard by zero automated tests and thin failure-handling. |
| **Architecture** | **8.5 / 10** | Clean feature-sliced structure with a real repository boundary and DB-enforced gating. |
| **Security** | **8.5 / 10** | Genuinely strong: complete RLS, verified webhooks, XSS-safe rendering. Gaps are defense-in-depth, not holes. |
| **Overall** | **~8 / 10** | A legitimately impressive product one focused sprint away from a 9+. |

---

## 1. Design review — *as a design director* → 7.5 / 10

### What's genuinely strong
- **A real token system.** `src/styles/index.css` drives everything off `"r g b"` channel variables wired into Tailwind semantic colors (`base`, `fg`, `fg-muted`, `ox`); themes flip by swapping variables. This is how mature design systems are built.
- **First-class dual theming** — Day/Night designed as a pair (per-theme glass fills, hairlines, deepened button fills on dark), no-flash pre-paint script, synced browser `theme-color`, View-Transition cross-fade on switch.
- **Motion is a system, not decoration** — shared spring presets in `src/lib/motion.ts` reused across `Reveal`, `Modal`, `GlassSelect`, `ThemeToggle`; the `GlassCard` pointer-tilt is a standout micro-interaction.
- **Better-than-average a11y bones** — global oxblood `:focus-visible` ring, keyboard-operable kanban (KeyboardSensor + sortable coordinates), icon buttons labeled everywhere, forms use `useId` + `aria-invalid` + `aria-describedby`, reduced-motion respected in the physical animations.
- **State completeness** — the same loading (content-shaped skeletons) / error / empty trio appears across every feature. Mobile craft is real: `dvh`, `env(safe-area-inset-*)`, drawer + bottom nav, touch-tuned drag.

### What's holding it back
- **A three-name identity crisis (P0).** "Aurora" appears in **38 files** including user-visible chrome — the browser `<title>`, PWA install name (`vite.config.ts` manifest), the sidebar wordmark (`Brand.tsx`), and the style guide — while the product is **Nvexis** and the marketing calls itself **Lodestar**. The installed app literally shows the wrong brand.
- **Light-mode contrast failures (P0, accessibility).** Label pills render full-saturation hex as *text* on a ~16% tint (`labelColors.ts` + `LabelPill.tsx`): cyan ≈ 1.9:1, emerald ≈ 1.8:1, amber ≈ 1.5:1 against the 4.5:1 AA requirement. Priority pills (`priority.ts`) and the fixed-hex `success`/`info` badge colors (`tailwind.config.ts`) fail similarly on their backgrounds.
- **No focus trap / focus restoration in overlays (P0).** `Modal.tsx`, `CommandPalette.tsx`, and the mobile drawer let Tab escape to the background and never restore focus to the trigger on close — the biggest keyboard/AT defect for a modal-heavy app.
- **A dead primary affordance (P1).** The Topbar "Search projects, cards, notes…" control is a `<button>` with **no `onClick`** (`Topbar.tsx`) — the most prominent control does nothing on click; only ⌘K opens the palette.
- **The brand bible contradicts the app.** `DESIGN-GUIDELINES.md` bans glassmorphism, gradients, glow, and gold-as-primary — all of which the app is built on. A source-of-truth the whole product contradicts erodes the system's authority.
- **Framer mount animations ignore reduced-motion (P1).** No `<MotionConfig reducedMotion="user">`, so `Reveal`/`Modal`/`GlassSelect` still animate for users who asked not to (the CSS guard can't stop JS-driven transforms).

### Path to 9.5+
1. **P0** — Purge "Aurora"/"Lodestar" → one product name everywhere, starting with `index.html`, the PWA manifest, and `Brand.tsx`.
2. **P0** — Fix label/priority/badge contrast: use a darkened per-theme text token instead of the swatch hex; make `success`/`info` theme-reactive.
3. **P0** — Add a focus-trap + restore-focus utility to `Modal`, `CommandPalette`, and the drawer; wire `aria-labelledby` to the visible heading.
4. **P1** — Wire the Topbar search to open the command palette; wrap the app in `MotionConfig`; add a skip-to-content link.
5. **P2** — Consolidate the radius scale (currently `lg/xl/2xl/3xl/4xl` used interchangeably); reconcile or rewrite the brand guidelines; replace the fabricated marketing testimonials before launch.

---

## 2. Engineering & architecture — *as a staff engineer*

**Engineering quality: 7.5 / 10 · Architecture: 8.5 / 10**

### Sub-scores
| Dimension | Score | Note |
|---|---|---|
| Type safety | 9.5 | `strict` + `noUncheckedIndexedAccess` + `no-explicit-any: error`; **0** real `any`, **0** `@ts-ignore`. |
| State / data layer | 9.0 | Textbook TanStack Query optimistic pattern (`cancel → snapshot → rollback → invalidate`) factored into reusable hooks. |
| Error handling | 6.0 | A good `ErrorBoundary` exists but wraps only the note editor; mutation failures roll back **silently** (no toast). |
| Performance | 6.5 | Good lazy-splitting, but **0** `React.memo`, no React Compiler, large main bundle (PWA cap raised to 4 MB). |
| Testing | 0.5 | **Zero** test files, no runner, no CI across 33k LOC. |
| Tooling / build | 7.5 | Strict project-refs tsconfig, typed ESLint, Prettier, PWA — but no CI, no test script, no bundle analysis. |
| Maintainability | 8.5 | Outstanding module-level docs (every file explains *why*), tiny focused files, single-source-of-truth constants. |

### Strengths
- **Clean feature-sliced architecture** (`src/features/<domain>/{api.ts, use*.ts, schemas.ts, components}`) with a real repository boundary: only `AuthProvider.tsx` imports `@/lib/supabase` directly; all other data access flows through per-feature `api.ts`.
- **Domain logic centralized** as single sources of truth (`lib/plans.ts`, `lib/proFeatures.ts`, `board/ordering.ts`) and **dual-enforced** (client UX + DB), so the client is never the gate.
- **Distributed-systems-aware collaboration** — the custom `SupabaseYjsProvider` cleanly separates transport from the CRDT model (`yCanvasDoc.ts`) from the React binding (`useYjsCanvas.ts`): correct sync-step handshake, echo suppression, awareness throttling, scoped undo.
- **Resilience touches** — `useOnlineStatus` probes real backend reachability rather than trusting `navigator.onLine`; the query cache is wiped on sign-out so nothing leaks on a shared device.

### The two things capping it
- **No automated tests (P0).** The pure logic that most needs them is already perfectly testable: `board/ordering.ts` (fractional-rank collisions), `lib/dueAt.ts` (timezone math), the Yjs scene diffing, the optimistic reconcilers. Add Vitest + a CI workflow running `typecheck && lint && test && build`.
- **Thin failure-handling (P0).** An `ErrorBoundary` component exists (`components/feedback/ErrorBoundary.tsx`) but is applied only in `NoteEditor.tsx` — the root route `<Outlet/>` (`AppShell.tsx`) and every other `<Suspense>`/lazy chunk are unguarded, so a render error or failed chunk-load *outside the note editor* white-screens the app. Separately, all ~14 mutation hooks' `onError` only roll back the cache with **no user feedback** — a failed card move/rename silently snaps back.

### Path to 9.5+
1. **P0** — Wrap the root `<Outlet/>` and each lazy `<Suspense>` in the existing `ErrorBoundary` (pair with `QueryErrorResetBoundary`).
2. **P0** — Add a global `MutationCache({ onError })` + a lightweight toast so writes fail *visibly*.
3. **P0** — Introduce Vitest + CI; start with the pure logic modules above.
4. **P1** — Add a stable ordering tiebreaker (`position, then created_at/id`) + periodic rebalance to `ordering.ts` (concurrent midpoint moves can collide); memoize board/calendar leaf components (or enable the React 19 compiler); add Rollup `manualChunks` (Konva / Tiptap / vendor).
5. **P2** — Generate `types/database.ts` from Supabase (`supabase gen types`) instead of hand-maintaining 1,049 lines; extract the duplicated optimistic-mutation factories into one generic hook.

### Code-health metrics (verified by grep)
`any`: **0** · `@ts-ignore`: **0** · `console.log`: **0** (2 justified warn/error) · `TODO/FIXME`: **0** · tests: **0** · `React.memo`: **0** · dependency vulns (`npm audit --omit=dev`): **0**.

---

## 3. Security / white-hat audit — 8.5 / 10

**This is the strongest part of the codebase.** I probed the auth model, all four edge functions, every RLS migration, the billing trust boundary, and the XSS surface. Everything load-bearing is done correctly — the findings below are hardening and one privacy issue, not open doors.

### What's done right
- **RLS on 100% of tables.** All **25** application tables have `enable row level security` — the single most common Supabase vulnerability (a table left unprotected) is fully avoided.
- **Textbook multi-tenant RLS.** Access is gated through `SECURITY DEFINER` helpers (`is_project_member`, `can_edit_project`) with `search_path` pinned to `''` and every reference schema-qualified — the documented defense against search-path hijacking and policy recursion. Role enforcement is real: writes require `role in ('owner','editor')`, so viewers are read-only at the DB layer.
- **The billing boundary can't be forged.** A `protect_plan_columns` trigger rejects any change to `plan`/`plan_status`/`dodo_*` unless the JWT role is `service_role` — a user **cannot self-upgrade to Pro** by editing their own profile. The free-tier project cap is enforced by a trigger, not the UI.
- **Webhook verification is correct.** `dodo-webhook` verifies the Standard-Webhooks HMAC-SHA256 signature over the **raw body before any parse or DB write**, with a 5-minute replay tolerance and a **constant-time** compare. The verified webhook is the *only* thing that flips a plan.
- **No IDOR in billing.** `dodo-create-checkout` sets `metadata.user_id` server-side from the verified JWT (never client input); `dodo-portal` resolves the customer id from the caller's *own* profile — a user can only ever reach their own billing.
- **Secrets are clean.** Only the public anon key ships to the browser (`lib/supabase.ts`); `service_role` lives only in edge functions. `.env` is gitignored, never committed, and git history is secret-free.
- **XSS-safe by construction.** The notes renderer emits React elements (no `innerHTML`, URL allow-list). The *one* `dangerouslySetInnerHTML` (canvas text) is fed by Tiptap `generateHTML`, whose `SafeLink` extension sanitizes `href` on **both parse and render** (http/https/mailto only) and text is escaped by ProseMirror. Reminder emails escape all user content. The storage bucket is private (signed URLs), RLS-gated, and excludes SVG to block script injection.

### Findings

| # | Severity | Finding | Fix |
|---|---|---|---|
| 1 | **Low** | **Account/email enumeration oracle.** `user_id_for_email(text)` is granted to every authenticated user and returns the UUID for any email; `share_canvas`/`share_note` also reveal existence via a distinct "No Nvexis user" error. An authed attacker can confirm which emails have accounts. | Revoke direct `execute` and inline the lookup inside the share RPCs; return a generic result whether or not the email matched. |
| 2 | **Low** | **Webhook doesn't validate product or business.** `subscription.active` grants Pro for *any* product id, and `business_id` isn't checked. Harmless today (one product), but any future cheaper product would also grant Pro. | Validate `data.product_id ∈ {monthly, annual}` and assert `event.business_id`. |
| 3 | **Low** | **Unvalidated id in PostgREST filter.** The webhook interpolates `metadata.user_id` into `id=eq.${userId}`. Server-set and signature-gated (not currently exploitable), but unvalidated. | Assert UUID shape before building the filter. |
| 4 | **Info** | **Plaintext secret file in the working tree.** `Aurora payment api.txt` holds a webhook secret. It's gitignored and never committed, but a live secret sitting in the repo folder risks leakage via backup/sync/screen-share. | Delete it; keep secrets only in the Supabase dashboard. |
| 5 | **Info** | `CRON_SECRET` compared with `!==` (non-constant-time); edge-function CORS is `*`; no app-level rate limiting on checkout/portal. | Constant-time compare; scope CORS to `APP_URL`; add basic throttling. |
| 6 | **Info** | XSS defense rests entirely on the hardened Tiptap schema + React escaping (no server-side sanitizer). Robust today; fragile to a future extension misconfig. | Add a `DOMPurify` pass over `generateHTML` output as defense-in-depth. |

### Path to 9.5+
Close findings 1–3, remove the plaintext secret file, tighten CORS + add rate limiting, add a DOMPurify layer — and, most importantly for *assurance* (not just posture), add **automated RLS/security regression tests** and commission one **external penetration test**. The engineering is right; what's missing is proof it stays right.

---

## Bottom line
Nvexis is the work of someone who clearly knows this stack deeply. The **security model is excellent**, the **architecture is clean**, and the **type discipline is elite**. Three things separate it from a 9.5 across the board: a **testing + CI safety net** (currently zero), **comprehensive failure-handling** (error boundaries at the root + visible mutation errors), and a **design-polish pass** (one brand name, AA contrast, focus traps). None are deep rewrites — they're a focused sprint.
