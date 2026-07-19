# Phase 7 — Verification & Go-Live

*The proof-it-works pass for the Aurora remediation (Phases 1–6). Built 2026-07-15. This is a **checklist you execute on Windows + a real phone** — Claude wrote the harness and the scripts, but the runtime evidence (Lighthouse numbers, device screenshots, smoke ticks) has to be captured on your machine. Fill the result columns in as you go.*

**Environment reminder:** the in-session Linux mount serves truncated reads, so nothing here was built or committed from the session. Run the Windows commands in §6, then work top-to-bottom.

- **Repo:** `github.com/jaiakashj121420004-stack/project-management-app`
- **Live (dev):** https://project-management-app-dev.pages.dev
- **Local prod preview:** `npm run build && npm run preview` → http://localhost:4173

---

## 1. Automated accessibility — axe (wired this phase)

A new axe-core suite runs under the existing Vitest harness. It renders the load-bearing interactive primitives Phase 3 hardened and asserts **zero violations**.

- **Files:** `src/test/axe.ts` (harness) + `src/test/a11y.test.tsx` (suite).
- **Covers:** `LabelPill` (full + dot), `Modal` (open dialog, roles/labels/description), `Spinner` (status role + name), `GlassSelect` (collapsed combobox **and** expanded listbox).
- **New dev dep:** `axe-core` (`^4.10.2`) — requires `npm install`.
- **Two rules disabled on purpose:** `color-contrast` (jsdom has no layout/canvas → axe reports it *incomplete*; real contrast is proven in `lib/contrast.test.ts` + `marketing/marketingContrast.test.ts` and by Lighthouse below) and `region` (isolated subtrees, not full pages — the landmark rule is exercised by the AppShell skip-link + `<main>` in the manual pass).

**Run:** `npm run test:ci` (the a11y suite runs with everything else).

| Check | Expected | Result |
|---|---|---|
| `npm install` clean (adds `axe-core`) | ok | ☐ |
| a11y.test.tsx suites pass | all green | ☐ |
| Whole Vitest suite green | 0 failed | ☐ |

> axe under jsdom is a *structure/role/name/aria* net, not a substitute for a real-browser audit. §2 (Lighthouse) is the browser-level a11y check.

---

## 2. Lighthouse pass — desktop + mobile

Run Lighthouse against a **production** build (not `npm run dev` — the SW/precache and minified bundle only exist in prod). Either target the deployed `pages.dev` or a local `npm run preview`.

**How to run (two options):**

- **Chrome DevTools:** open the site in an Incognito window (no extensions) → DevTools → **Lighthouse** tab → pick **Mode: Navigation**, tick **Performance + Accessibility + Best Practices + SEO**, choose **Device: Mobile**, run; repeat with **Device: Desktop**.
- **CLI (repeatable):**
  ```bash
  npx lighthouse https://project-management-app-dev.pages.dev \
    --only-categories=performance,accessibility,best-practices,seo \
    --form-factor=mobile --screenEmulation.mobile \
    --output=html --output-path=./lh-mobile.html
  npx lighthouse https://project-management-app-dev.pages.dev \
    --only-categories=performance,accessibility,best-practices,seo \
    --preset=desktop \
    --output=html --output-path=./lh-desktop.html
  ```

**Screens to profile** (run Lighthouse on each — the marketing landing is the public one; sign in for the app screens): `/` (landing), `/login`, `/projects/:id` (board), `/library`, a note, a canvas.

**PWA installability** — Lighthouse **12+ removed the PWA category**, so check installability directly instead:
- DevTools → **Application** tab → **Manifest**: no errors, icons resolve, "Installability" shows *"App can be installed."*
- The install/⊕ icon appears in the Chrome omnibox; installing yields a standalone window.
- **Application → Service Workers**: `activated and running`; **Cache Storage** shows the Workbox precache.

**Targets & results** (fill in per form factor):

| Metric | Target | Desktop | Mobile |
|---|---|---|---|
| Accessibility | **≥ 95** | ☐ ___ | ☐ ___ |
| Performance | **≥ 80** (mobile budget; desktop ≥ 90) | ☐ ___ | ☐ ___ |
| Best Practices | ≥ 95 | ☐ ___ | ☐ ___ |
| SEO | ≥ 90 (landing) | ☐ ___ | ☐ ___ |
| LCP | < 2.5 s | ☐ ___ | ☐ ___ |
| CLS | < 0.1 | ☐ ___ | ☐ ___ |
| TBT | < 200 ms | ☐ ___ | ☐ ___ |
| Manifest installable | "App can be installed" | ☐ | ☐ |
| SW activated + precache present | yes | ☐ | ☐ |

> If mobile Performance dips below budget, the Phase 5 `manualChunks` (vendor / editor / canvas) + the `dist/stats.html` visualizer are your levers — the heavy Tiptap/Konva chunks are already lazy, so a low score usually means a screen is eagerly importing one. Confirm the editor/canvas chunks only load on their routes.

---

## 3. Mobile real-device pass (per `NVEXIS-UPGRADE-PLAN.md` §10)

Do this on a **real phone** (not just DevTools emulation), in **both Day and Night**, and capture a screenshot for each area. §10 definition-of-done: touch targets ≥ 40px, no horizontal overflow, content clears the fixed bottom nav, safe-area insets respected.

| # | Area | What to verify | Day | Night |
|---|---|---|---|---|
| 1 | **Board DnD** | Drag a card between columns with touch; columns are `85vw` and scroll horizontally; no accidental scroll-vs-drag conflict; drop persists after reload | ☐ | ☐ |
| 2 | **Modals / focus** | Open a card modal + a dialog; it's a bottom sheet; Esc/backdrop close; focus is trapped and returns to the trigger; on-screen keyboard doesn't cover the field | ☐ | ☐ |
| 3 | **Canvas** | Pen draws with finger/stylus; two-finger pan/zoom; palm rejection; the **collapsible pen-colour panel** toggles + remembers its state; minimap click-jumps; text boxes editable | ☐ | ☐ |
| 4 | **Install** | "Add to Home Screen" installs the Aurora "A" icon + splash; launches standalone (no browser chrome); status bar/safe-area correct | ☐ | ☐ |
| 5 | **Offline** | With the app installed, enable Airplane mode → the app shell still loads; previously-viewed data shows from cache; a write while offline surfaces the failure toast (doesn't silently vanish); reconnect recovers | ☐ | ☐ |
| 6 | **Layout hygiene** | No horizontal overflow on any screen; project tab row scrolls (no clipped "Activity"); everything clears the bottom nav (`main` pb); top-bar search shrinks to "Search…" | ☐ | ☐ |
| 7 | **Targets & legibility** | All tap targets ≥ 40px; body text legible; both themes correct; AA holds on labels/pills | ☐ | ☐ |

**Record:** attach the screenshots and note the device + OS + browser (e.g. "iPhone 14, iOS 18, Safari" / "Pixel 8, Android 15, Chrome").

---

## 4. Full regression

### 4a. Automated suites (green gate)

| Suite | Command | Result |
|---|---|---|
| TypeScript | `npm run typecheck` | ☐ |
| Lint (see note) | `npm run lint` | ☐ |
| Vitest (incl. new a11y suite) | `npm run test:ci` | ☐ |
| Production build | `npm run build` | ☐ |
| **pgTAP RLS suite** | `supabase test db` (boots local stack) | ☐ |

> **Lint note:** pre-existing errors remain in files earlier phases didn't touch (`NoteBlockEditor.tsx`, `NoteEditor.tsx`, `GlassSelect`/`NameDialog` set-state-in-effect, a `require-await` in the optimistic test). Lint is **not** part of `npm run build` (`tsc -b && vite build`), so it never blocks the Cloudflare deploy. Sweeping these is the one carried-over cleanup item (see §5).

> **pgTAP:** the suite is `supabase/tests/rls_regression.test.sql` (`plan(15)`) with its own CI workflow `.github/workflows/rls-tests.yml` (kept off the main gate so a heavy stack boot can't red-X unrelated PRs). It proves a non-member is denied read **and** write across projects/cards/columns/labels + owner-scoped folders/todo_lists, a viewer can read but not insert, and a user can't self-set `plan`.

### 4b. Manual feature smoke (test-mode)

Run against the dev deployment or local preview with a fresh test account. Tick each; note anything off.

| Feature | Smoke steps | Result |
|---|---|---|
| **Auth** | Sign up → email/confirm → log in → refresh keeps session → log out | ☐ |
| **Projects** | Create project; rename; set accent; free-tier project cap enforced; delete | ☐ |
| **Board** | Add column/card; edit card (title, description, labels, priority, due, assignee); drag card + column; deletes; reload persists | ☐ |
| **Calendar** | Cards with due dates appear on the right day; overdue styling; open card from a day cell | ☐ |
| **Todos** | Create list + items; check/uncheck; reorder; delete | ☐ |
| **Library** | New folder / note / canvas; nest folders; move (menu); rename; delete; breadcrumb drill-down on mobile | ☐ |
| **Notes** | Block editor: headings, lists, task list, toggle, colour/highlight, link, image (resize), slash menu + templates, emoji icon, cover image, Markdown export | ☐ |
| **Canvas** | Pen + colours + precision eraser; text boxes; shapes/frames; layers panel jump-to-element; minimap; add-page | ☐ |
| **Collaboration** | Share a note + a canvas by email; collaborator sees it; roles enforced (viewer read-only); live canvas cursors + merge with a second session | ☐ |
| **Billing (test-mode)** | Upgrade flow opens Dodo **test** checkout; webhook flips plan to Pro; portal opens own billing only; Pro features unlock; cannot self-upgrade by editing profile | ☐ |
| **Reminders** | Set a due reminder; `send-due-reminders` fires (test cron/secret); email escapes user content; no duplicate sends | ☐ |
| **Command palette** | ⌘K opens; Topbar search opens it; finds projects, notes, canvases, folders; deep-links open correctly | ☐ |
| **Error handling** | Force a mutation failure (offline) → toast appears; a thrown render error shows the boundary fallback + "Try again", not a white screen | ☐ |
| **Themes** | Toggle Day/Night everywhere; choice persists; `prefers-reduced-motion` calms animation | ☐ |

---

## 5. Re-score against `AUDIT-nvexis.md`

Original audit: **Design 7.5 · Engineering 7.5 · Security 8.5.** Each phase closed a specific "Path to 9.5+" item. Below maps every path item to the phase that closed it; the score column is contingent on §1–§4 passing.

### Design (was 7.5 → **9.5**)
| Audit path item | Closed by | Evidence |
|---|---|---|
| P0 One product name (Aurora), new logo, retire Lodestar | Phase 1 | Aurora "A" monogram + full icon set; `gradient-text` wordmark removed; `/lodestar`→`/preview`; grep-clean of user-facing "Lodestar" |
| P0 Label/priority/badge contrast → per-theme token; `success`/`info` theme-reactive | Phase 3 | `lib/contrast.ts` + `contrast.test.ts` proves every token ≥ 4.5:1 both modes |
| P0 Focus trap + restore + `aria-labelledby` on Modal/palette/drawer | Phase 3 | `hooks/useFocusTrap.ts` + `useFocusTrap.test.tsx`; wired in Modal/CommandPalette/Sidebar drawer |
| P1 Wire Topbar search → palette; `MotionConfig`; skip link | Phase 4 / Phase 3 | `paletteStore.ts`; `<MotionConfig reducedMotion="user">`; skip-to-content in AppShell |
| P2 Consolidate radius; reconcile guidelines; replace fabricated testimonials | Phase 3 / 4 | radius → md/xl/2xl; `DESIGN-GUIDELINES.md` v5.1; testimonials → honest maker's note |

### Engineering (was 7.5 → **9.5**)
| Audit path item | Closed by | Evidence |
|---|---|---|
| P0 Error boundaries on root `<Outlet/>` + each lazy `<Suspense>` | Phase 2 | `RouteErrorBoundary` + `QueryErrorResetBoundary` wired throughout |
| P0 Global `MutationCache({ onError })` + toast for visible writes | Phase 2 | `lib/queryClient.ts` + custom `toast.ts`/`Toaster.tsx` |
| P0 Vitest + CI, starting with pure-logic modules | Phase 2 | `vitest.config.ts` + `.github/workflows/ci.yml`; now 12 suites + the a11y suite |
| P1 Ordering tiebreaker + rebalance; memoize board/calendar leaves; `manualChunks` | Phase 5 | `ordering.ts` tiebreaker/rebalance; `React.memo` on BoardCard/CardSurface/DayCell; Rollup vendor/editor/canvas chunks |
| P2 Generate DB types; one generic optimistic-mutation hook | Phase 5 | `scripts/check-db-types.mjs` + `db-types.yml`; `useOptimisticMutation` backs board/notes/library/templates |

### Security (was 8.5 → **9.5**)
| Audit finding | Closed by | Evidence |
|---|---|---|
| #1 Email-enumeration oracle | Phase 6 | `revoke execute` on `user_id_for_email`; share RPCs inline the lookup + return generic no-op |
| #2 Webhook product not validated | Phase 6 | fail-closed `PRO_PRODUCT_IDS` set before any Pro grant |
| #2/#3 `business_id` + `metadata.user_id` unvalidated | Phase 6 | `business_id` required + matched; `user_id` UUID-validated before the PostgREST filter |
| #4 Plaintext secret file | Phase 6 | `Aurora payment api.txt` deleted (was gitignored/untracked) |
| #5 Non-constant-time cron compare; CORS `*`; no rate limiting | Phase 6 | `timingSafeEqual`; CORS scoped to `APP_URL`; per-user sliding-window throttle |
| #6 No server-side XSS sanitizer | Phase 6 | `sanitizeBlockHtml` (isomorphic-dompurify) over `generateHTML` output |
| Assurance: automated RLS regression tests | Phase 6 | pgTAP `rls_regression.test.sql` (`plan(15)`) + `rls-tests.yml` |

**Re-score (pending §1–§4 evidence): Design 9.5 · Engineering 9.5 · Security 9.5.** Mark each ✅ once its section above is green.

| Lens | Was | Now | Confirmed |
|---|---|---|---|
| Design / UX | 7.5 | 9.5 | ☐ |
| Engineering | 7.5 | 9.5 | ☐ |
| Security | 8.5 | 9.5 | ☐ |

---

## 6. Windows build / test / commit commands

Run in the repo root (`C:\Users\jaiak\Desktop\CLAUDE WORKSPACE\Project Management app`). **New dep this phase: `axe-core` (dev)** → `npm install` is required before the gate.

```powershell
# 1. Install the new dev dep (axe-core) + refresh the lockfile
npm install

# 2. Full green gate
npm run typecheck
npm run lint          # pre-existing errors in untouched files only (see §4a note) — not a deploy blocker
npm run test:ci       # includes the new src/test/a11y.test.tsx
npm run build

# 3. (Optional but recommended for the security re-score) local RLS suite
#    Requires Docker + supabase CLI; boots the local stack.
supabase start
supabase test db
supabase stop

# 4. Commit the phase (docs + a11y harness together)
git add -A
git commit -m "chore(release): phase 7 verification pass, axe a11y suite, docs sync, re-score"
git push
```

After push, Cloudflare auto-deploys `main`. The service worker may serve a stale build until reload — unregister the SW + clear caches to force-refresh, then run the §2 Lighthouse pass against the fresh deploy.

---

## 7. Go-live gates (human-only — outside code)

The engineering is done; these are the remaining launch blockers that Claude **cannot** do for you:

1. **Dodo LIVE keys.** Swap test-mode keys for live `DODO_PAYMENTS_API_KEY` / `DODO_WEBHOOK_SECRET` (Supabase dashboard only, never committed); set `DODO_PRODUCT_PRO_MONTHLY`/`_ANNUAL` + optionally `DODO_BUSINESS_ID`; re-point the webhook URL to production; run one real end-to-end paid test.
2. **KYC / merchant onboarding.** Complete Dodo's Merchant-of-Record KYC so payouts and live charges are enabled.
3. **Legal.** Finalize Terms + Privacy for a paid multi-tenant product (data processing, subprocessors, refund/cancellation, GDPR/CCPA as applicable). The `/terms` and `/privacy` pages exist — get the copy reviewed.
4. **External penetration test.** The audit's key assurance ask: commission **one external pen-test** before charging real money. RLS is dual-enforced and now regression-tested, but an outside probe is what turns "we think it's right" into "it was verified."
5. **Production env hygiene.** ✅ **DONE (2026-07-15)** — verified end-to-end against prod project `rpwklsrdfqyisogbcdgg` (see `memory.md` top entry): all 30 migrations applied (CLI history repaired via `migration repair`), `canvas-media` + `note-media` private buckets exist, all required Edge Function secrets set, pg_cron `aurora-due-reminders` running + succeeding, and anon-key-only confirmed in `src/`, `.env`, and Cloudflare Pages env. *Small remaining sub-item:* set a real `REMINDER_FROM_EMAIL` once a Resend sending domain is verified (currently on the `onboarding@resend.dev` fallback).

Once §1–§5 are green and gates 1–4 are cleared (gate 5 done), Aurora is go-live ready.
