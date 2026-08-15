# Aurora — Improvement Plan (Aug 2026)

*A session-by-session build plan. Not a replacement for `plan.md` (the architecture spec) — this is the punch list from your 15 Aug 2026 planning session, sequenced and turned into copy-paste prompts.*

## How to use this file

Each task below is meant to be **its own fresh Claude Code session**, opened in the Aurora project root (`C:\Users\jaiak\Desktop\CLAUDE WORKSPACE\Project Management app`). CLAUDE.md auto-loads there, so the session already knows the golden workflow (read `memory.md` → do the work → update `memory.md` → commit). Each prompt below is self-contained: paste it in as the first message of a new session and it has everything it needs — the current file names, the current bug/gap, the exact fix, and what "done" looks like.

**Order matters less than it looks.** Tasks are sequenced easy→hard and grouped so early tasks (cleanup, analytics) make later tasks cheaper — e.g. instrumenting analytics early means every feature built after it can just add one tracking call instead of a separate retrofit pass later. But nothing here is tightly coupled; if you want to skip around, the only real dependency is **Task 1 informs Task 10 and Task 11** (research → what to build / what to say no to).

**Thinking-effort labels** (Sonnet Low / Medium / High) reflect how much the task rewards careful reasoning vs. how mechanical it is — not how long it'll take. Set these deliberately; over-thinking a mechanical task wastes tokens, under-thinking a design-judgment task produces slop.

**Skipped for now, by your call:** Play Store / App Store presence. The strategy report (§11) already recommends staying web-only until there are paying users, and you confirmed you don't want to touch this yet. No task below covers it — revisit later using that report section.

---

## Task 1 — Competitor research + a "Simplicity Guardrail" doc

**Session effort: Sonnet Medium thinking** (judgment-heavy synthesis, not code)
**Depends on:** nothing. Do this first — it feeds Tasks 10 and 11.

**Why first:** You've been explicit that Aurora must never need "a 10-hour course." Before building the Tables feature or writing the anti-bloat checklist, there should be one short reference doc that says, concretely, what a first-time user should never have to learn on day one — and what specific features from Notion/ClickUp/Monday/Asana/Trello are worth stealing vs. worth deliberately rejecting. Every later prompt in this plan can then just say "check against SIMPLICITY-GUARDRAIL.md" instead of re-litigating the philosophy each time.

**Prompt to paste into a new session:**
```
Read memory.md and CLAUDE.md first, then DESIGN-GUIDELINES.md §0-1.

I want two short reference documents, not code changes. Aurora's non-negotiable
constraint: it must never require a tutorial or course to use well — a first-time
user, including someone in their 60s who isn't especially tech-savvy, should be
able to use every feature confidently within minutes. At the same time it needs
to be genuinely full-featured, not stripped-down.

1. Web-search current (2026) feature sets and, where available, UX/complaint
   research for Notion, ClickUp, Monday.com, Asana, and Trello. Specifically look
   for: (a) features real small teams and freelancers actually rely on that
   Aurora is currently missing (cross-reference against what's already in
   CLAUDE.md/plan.md's feature list — boards, to-do planner w/ recurrence,
   calendar w/ ICS feed, notes, canvas, real-time collaboration), and (b) the
   specific features/patterns most commonly cited as making these tools
   overwhelming or requiring onboarding (this connects to what the existing
   Aurora_Full_Strategy_Report_2026-08-13.html in /reports already found in §4:
   "overwhelm" is the #1 stated reason people leave Notion/ClickUp).

2. Write reports/FEATURE-GAP-ANALYSIS.md: a short, prioritized list of concrete
   features/capabilities worth considering for Aurora's roadmap, each with a
   one-line "why a real small team needs this" and a one-line complexity
   estimate. Do not include anything already covered elsewhere in this
   improvement plan (tables, MCP, analytics, etc. — those are already scoped).
   Flag anything that risks the bloat problem explicitly, even if it's popular.

3. Write reports/SIMPLICITY-GUARDRAIL.md: a short, concrete checklist (aim for
   8-12 items, not a wall of text) to run every future feature idea through
   before building it. Examples of the kind of question it should contain (write
   your own, grounded in what you found): "Does this add a new top-level nav
   item, or does it live inside something that already exists?", "Can a
   first-time user understand what this button does without a tooltip?", "Does
   this feature have a sensible zero-config default, or does it force a setup
   step before it's useful?", "If we had to explain this in one sentence to a
   60-year-old first-time user, could we?". Ground it in the actual research,
   not generic advice.

Follow the golden workflow: update memory.md with what was produced and where,
then commit both new files with a `docs:` commit. No app code changes in this
session.
```

---

## Task 2 — Remove the leftover pre-rebrand font dependencies [DONE 2026-08-15, see memory.md]

**Session effort: Sonnet Low thinking** (mechanical, low-risk)
**Depends on:** nothing.

**Why now:** Confirmed still present in `package.json`: `@fontsource-variable/inter` and `@fontsource-variable/space-grotesk`. CLAUDE.md's design rules explicitly say "Never Inter." They're not imported anywhere live today, but a dead, on-brand-violating dependency sitting in package.json is exactly the kind of thing a future contributor (or an AI assistant reaching for a "normal" font) reintroduces by accident. Fifteen-minute fix, real risk removed.

**Prompt to paste into a new session:**
```
Read memory.md first.

package.json currently lists two unused, brand-violating dependencies left over
from before the Nvexis rebrand: "@fontsource-variable/inter" and
"@fontsource-variable/space-grotesk" (CLAUDE.md's design rules explicitly say
"Never Inter" — the current type system is Fraunces/Spectral/IBM Plex Mono, all
loaded via the Google Fonts <link> in index.html, not via fontsource packages).

1. Grep the whole src/ tree to confirm neither package is actually imported
   anywhere (they shouldn't be — this has already been checked once — but
   verify before removing, and stop and report back if you find a live import
   instead of silently skipping it).
2. Remove both from package.json's "dependencies", then run npm uninstall for
   both (or npm install afterward) so package-lock.json stays in sync — don't
   hand-edit the lockfile.
3. Run `npm run typecheck` and `npm run build` to confirm nothing broke.
4. Update memory.md (move this off any relevant to-do, note the decision) and
   commit as `chore: remove leftover pre-rebrand font dependencies`.
```

---

## Task 3 — Ship minimal funnel analytics / instrumentation

**Session effort: Sonnet High thinking** (touches many flows; correctness and privacy posture both matter, and mistakes here are expensive to unwind later)
**Depends on:** nothing, but doing it early means every later feature task can add one tracking call instead of a retrofit pass.

**Why this early, and why it matters more than it looks:** The strategy report calls this "the single highest-leverage item in this entire report" (§9, priority 1) — right now there is zero visibility into signup → activation → upgrade, so every dollar and hour spent on the marketing plan later (Task 15) would be spent blind. It's also not that hard technically — a new table, a small tracking hook, and calls sprinkled at the right moments.

**Prompt to paste into a new session:**
```
Read memory.md, plan.md's data model + security sections, and CLAUDE.md first.

Aurora currently has zero product analytics — no event tracking anywhere in the
codebase. I want a minimal, privacy-respecting funnel-tracking layer, not a full
analytics platform. Design and build it end-to-end:

1. A new Supabase table, e.g. `analytics_events` (id, occurred_at, user_id
   nullable uuid, anonymous_id text, event_name text, properties jsonb, plus
   whatever else the existing migration conventions in supabase/migrations use).
   RLS: deny all direct client reads/writes (this table is written only through
   a dedicated edge function using the service role, matching the pattern
   already used for billing writes — see how the Dodo webhook edge function is
   the only writer of plan/subscription state, and follow the same
   defense-in-depth pattern: no client-side-only trust). Add it as a proper,
   idempotently-numbered migration following the existing naming convention in
   supabase/migrations.

2. A rate-limited edge function (mirror the rate-limiting pattern already used
   by the other edge functions in supabase/functions) that accepts
   { event_name, properties, anonymous_id } from an authenticated OR anonymous
   caller (the public marketing/landing/signup pages are pre-auth, so this must
   work logged-out too), stamps user_id server-side from the session if present,
   and inserts a row. Validate event_name against an allow-list server-side —
   don't let the client write arbitrary event names/payloads unbounded.

3. A small client-side lib (e.g. src/lib/analytics.ts) exposing one function,
   track(eventName, properties?), that: generates and persists an anonymous_id
   in localStorage on first use (a random UUID, not anything PII-derived),
   fire-and-forgets a call to the edge function (never blocks the UI, never
   throws into the caller on failure), and captures UTM params + referrer once
   on first landing-page visit per browser (store alongside the anonymous_id so
   it can be attached to the eventual signup event).

4. Wire calls at the key funnel moments the report identifies: landing page
   viewed, signup started, signup completed, first board created, first card
   created, upgrade-prompt shown (include WHICH limit triggered it — e.g. "3rd
   board" vs "3rd collaborator" — as a property, this is the single most useful
   piece of data per the report's §4 findings), checkout started, checkout
   completed (paid). Find the right components for each (ProjectsPage/board
   creation, Board.tsx card creation, wherever ProGate renders its upsell,
   the Dodo checkout flow) — grep for these rather than guessing paths.

5. Do NOT build a dashboard/admin UI in this session — that's a separate future
   task. The events landing in the table, queryable via Supabase Studio SQL for
   now, is the full scope here.

6. Write a short section in memory.md (or a new reports/ANALYTICS.md if that
   reads better) documenting the event names and their properties as a schema
   reference, so nobody has to reverse-engineer it from the code later.

Follow the golden workflow throughout: read state before starting, update
memory.md with the new decision + file structure, commit with `feat: add
minimal funnel analytics instrumentation`. Run typecheck/build/tests before
committing.
```

---

## Task 4 — "Add to Home Screen" button

**Session effort: Sonnet Medium thinking**
**Depends on:** nothing.

**Why now, and grounded in what's already there:** Aurora is already a fully-configured PWA — `vite.config.ts` has `VitePWA` with a complete manifest, icons, and a service worker (`registerType: 'prompt'`), and `src/components/pwa/PWAReloadPrompt.tsx` already shows the exact toast/button visual pattern to reuse (a small glass pill, bottom-center, GradientButton action, Framer Motion spring). What's missing is any UI that tells a user installation is possible at all — most people have no idea a website can be "installed." This needs to work across Android/desktop Chrome (which fire a real `beforeinstallprompt` event you can hook) and iOS Safari (which never fires that event — install is manually "Share → Add to Home Screen," so iOS needs a small instructional modal instead of a native trigger).

**Prompt to paste into a new session:**
```
Read memory.md and CLAUDE.md first. Look at vite.config.ts's VitePWA config and
src/components/pwa/PWAReloadPrompt.tsx before starting — both are directly
relevant.

Aurora is a fully-configured installable PWA already, but there's no UI
anywhere that tells a user they CAN install it — most people don't know a
website can be added to their home screen. Add a small, unobtrusive "Install
Aurora" affordance:

1. A hook (e.g. src/hooks/useInstallPrompt.ts) that: listens for the browser's
   `beforeinstallprompt` event (Chrome/Edge/Android — preventDefault it and
   stash the event so it can be triggered later on a user click, not
   automatically), tracks whether the app is already running installed
   (matchMedia('(display-mode: standalone)') or navigator.standalone on iOS),
   and detects iOS Safari specifically (no beforeinstallprompt exists there —
   feature-detect via user agent / lack of the event).

2. A small button/icon, placed somewhere that's visible but doesn't crowd the
   UI — the Sidebar's bottom area (near the "Aurora · v0.1 · by Nvexis" footer
   text) or the Topbar are the two reasonable spots; pick whichever reads
   cleaner and say why. Hide it entirely once already installed or once the
   platform genuinely can't install (no event AND not iOS). On click: Chrome/
   Android → trigger the stashed native prompt. iOS → open a small modal with
   plain-language steps ("Tap the Share icon, then 'Add to Home Screen'") —
   keep this modal simple and glanceable, not a wall of text; a 60-year-old
   first-time user should be able to follow it without confusion.

3. Match the existing visual language exactly — GlassPanel/GradientButton,
   the same spring transitions used in PWAReloadPrompt.tsx, oxblood/accent
   tokens, no new visual pattern invented for this.

4. Track install-prompt-shown / install-accepted / install-dismissed via the
   analytics lib IF Task 3 (funnel analytics) has already been done in this
   repo — check whether src/lib/analytics.ts exists first; if not, skip this
   step, don't build a parallel tracking mechanism.

5. Test manually in Chrome desktop (the prompt should actually install the
   app) and confirm the iOS fallback modal renders sensibly at a phone
   viewport width.

Follow the golden workflow: update memory.md, run typecheck/build, commit as
`feat: add install-to-home-screen prompt`.
```

---

## Task 5 — Full immersive per-project color re-theme

**Session effort: Sonnet High thinking** (touches global shell chrome; needs to be scoped precisely so it reverts cleanly)
**Depends on:** nothing, but do Task 6 (custom color redesign) in a separate session — don't combine them, they touch overlapping CSS variables and mixing them in one session risks a confusing diff.

**What you confirmed:** when you're inside a project set to a color (e.g. the dark-green "Pine" accent), the ENTIRE app — sidebar, logo, topbar, buttons, everything — should switch to that color, and revert to Aurora's default oxblood the moment you leave that project.

**Important grounding — this is more tractable than it looks:** I checked `src/styles/index.css`. `--accent-from` / `--accent-to` / `--accent-glow` / `--accent-fg` are already defined at the theme root (`:root`/`.light`) as **aliases of the default oxblood brand color**, and `ProjectPage.tsx` already overrides those exact same variable names locally via inline style (`style={accentVars(project.accent)}`) — which is why the project's H1/tabs already pick up its accent correctly (you can see this working in your 4th screenshot). Most of the app's buttons, active states, and highlights (confirmed in `TabButton`, the to-do composer's add button, the calendar's "today" badge, the calendar-feed copy button, and very likely `GradientButton` — verify that one) already read `var(--accent-from)`/`var(--accent-to)`, not a separate hardcoded oxblood value. That means they'll automatically pick up a project's color for free, IF the override happens high enough in the DOM tree to contain the sidebar and topbar too — right now it's scoped only inside `ProjectPage.tsx`'s own content div, which sits below the Sidebar/Topbar in the tree, so they never see it.

The one deliberately-separate token is `--ox` (used specifically by the Aurora wordmark/logo tile in `Brand.tsx`, via `fill="var(--ox)"` and the `text-ox` Tailwind class) — that also needs overriding for the logo to follow along, since it's intentionally distinct from `--accent-from` per the brand docs.

**Prompt to paste into a new session:**
```
Read memory.md, CLAUDE.md's design rules, and DESIGN-GUIDELINES.md §3 (color
system) first. Then read these specific files before touching anything:
src/components/shell/AppShell.tsx, src/components/shell/Sidebar.tsx,
src/components/shell/Brand.tsx, src/components/shell/Topbar.tsx,
src/features/projects/ProjectPage.tsx, src/lib/accents.ts, and
src/styles/index.css (search for --accent-from, --accent-to, --accent-glow,
--accent-fg, --ox to see how they're defined at the theme root today).

Goal: when a user is viewing a specific project (route `/projects/:projectId`),
the ENTIRE app chrome — sidebar, topbar, the Aurora logo/wordmark, nav active
states, buttons, everything — should adopt that project's chosen accent color
(from the six in src/lib/accents.ts). The moment the user navigates away from
that project (back to /boards, /calendar, /todos, /settings, etc.), everything
must revert to Aurora's default oxblood brand color exactly as it is today.
This is a deliberate, confirmed product decision — not a bug to avoid, a
feature to build carefully.

Implementation approach (verify this is sound against the actual code, adjust
if the real structure differs from what's described above — don't force a
wrong approach because a doc said so):

1. In AppShell.tsx, determine the current project's accent. Use
   `useMatch('/projects/:projectId')` (or equivalent) from react-router-dom to
   read the projectId when the route matches, then call the SAME `useProject`
   hook ProjectPage.tsx already uses (src/features/projects/useProjects.ts) —
   it reads from the shared TanStack Query cache, so this costs no extra
   network fetch when ProjectPage has already loaded the data, and resolves
   correctly even on a hard refresh straight into a project URL.

2. Apply `accentVars(project.accent)` (from src/lib/accents.ts — the same
   helper ProjectPage already uses) via inline style on a wrapper element in
   AppShell that CONTAINS the Sidebar, Topbar, and main content — not just the
   Outlet content. Also set `--ox` to the same accent's `from` color on that
   same wrapper (confirm the exact CSS var Brand.tsx's logo/wordmark actually
   reads before assuming --ox is the only one — grep for `var(--ox)` and
   `text-ox` across src/ to find every consumer, and override all of them).
   When there's no matching project route (or the project hasn't loaded yet),
   apply nothing — the theme root's default oxblood values take over
   naturally, which is the correct "reverted" state.

3. ProjectPage.tsx's own existing `accentVars(project.accent)` on its content
   div becomes redundant once the wrapper above already sets the same
   variables — decide whether to remove it or leave it as a harmless no-op;
   prefer removing it to avoid two sources of truth, but check nothing else
   relies on it being scoped exactly to that div first.

4. Add a smooth CSS transition on color/background-color/border-color (a short
   one, ~200-300ms, matching the existing spring/easing conventions in
   src/lib/motion.ts) on the elements that change color, so switching between
   differently-colored projects (or leaving a project) fades rather than snaps.
   Respect prefers-reduced-motion (there's an existing pattern for this in the
   codebase — follow it, don't invent a new one).

5. Test manually across: opening a project with each of the 6 accents,
   navigating between two differently-colored projects back-to-back, leaving a
   project back to /boards (must revert to default oxblood), and a hard
   refresh landing directly on a project URL (must show that project's color
   immediately, not oxblood-then-flash-to-accent).

6. Double-check this doesn't fight the existing Day/Night theme toggle — the
   accent override should work identically in both themes (--accent-from/to
   already have separate Day/Night values at the theme root; accentVars from
   accents.ts should be checked for whether it needs its own per-theme
   variants, or whether the current single set of 6 accent colors is meant to
   work as-is in both — read accents.ts's own comments/usage for the answer,
   don't guess).

Follow the golden workflow: update memory.md with this decision, run
typecheck/build, commit as `feat: full immersive per-project accent theming`.
```

---

## Task 6 — Redesign custom background/text color personalization

**Session effort: Sonnet High thinking** (this is a design-taste problem as much as a code problem)
**Depends on:** nothing. Do this in its own session, separate from Task 5.

**Diagnosis, grounded in the actual code (src/lib/customTheme.ts, src/pages/SettingsPage.tsx, src/lib/contrast.ts):** the "cheap and ugly" feeling in your screenshots 5-6 has a precise cause. The custom-color feature is a raw, unrestricted hex picker with only a contrast-ratio warning — no aesthetic curation at all. Compare that to the project accent picker (`AccentPicker.tsx`), which only ever offers 6 pre-vetted, cohesive earthy tones and always looks intentional. Meanwhile `applyCustomTheme()` only ever touches `--bg`/`--fg`/`--fg-muted`/`--fg-subtle` — it deliberately leaves `--glass-fill`/`--glass-border` (the glassmorphism tint) and `--ox`/`--accent-from`/`--accent-to` (buttons, nav highlights) untouched and theme-locked. So a user can pick a jarring flat color like `#d33c3c` red, and the buttons/nav next to it stay a DIFFERENT, unrelated red-ish oxblood, the glass tint stays whatever the base Day/Night theme had, and nothing about the combination was ever checked for whether it looks good together — only whether text is technically readable. That combination of "arbitrary user-picked flat color + a design system that wasn't built to flex around arbitrary colors" is what reads as cheap, no matter how good the underlying glass/grain system is.

**Prompt to paste into a new session:**
```
Read memory.md and CLAUDE.md's design rules first. Then read src/lib/customTheme.ts,
src/pages/SettingsPage.tsx, src/lib/contrast.ts, and src/lib/accents.ts.

The Settings page's "Custom colors" feature (Pro-gated) lets a user pick ANY
background and text hex color via a raw color-wheel input, with only a
contrast-ratio warning. The result often looks cheap/ugly (confirmed by
screenshots of #000000 bg/#ffc800 text and #d33c3c bg/#000000 text) because: (a)
there's zero aesthetic curation, unlike the 6-option AccentPicker used for
per-project colors, which always looks intentional, and (b) applyCustomTheme()
only overrides --bg/--fg/--fg-muted/--fg-subtle — the glass tint
(--glass-fill/--glass-border) and the button/nav accent (--ox, --accent-from,
--accent-to) stay on their theme-default values regardless of what the user
picks, so an arbitrary custom color visibly clashes with everything else on
screen that DIDN'T change.

Fix this with a curated-first approach, not just better validation:

1. Design 6-10 curated "personalization presets" — full coordinated sets (not
   just a bg/fg pair): background, text, and a derived/complementary accent
   tint for buttons and highlights, each one designed to still feel like
   Aurora's "glass over parchment" aesthetic (see DESIGN-GUIDELINES.md §0-3)
   just in a different hue — e.g. a cooler slate/ink variant, a warmer
   terracotta variant, a deep forest variant, etc. Each preset must pass AA
   contrast (reuse src/lib/contrast.ts) by construction, not by warning.
   Present these as the primary, default UI — a grid of preview swatches, in
   the same visual language as AccentPicker.tsx (radiogroup, hover lift, a
   check mark on the selected one) rather than raw color inputs.

2. Keep the raw hex pickers, but demote them behind a clearly-labeled
   "Advanced: pick your own colors" disclosure/toggle — for the power user who
   wants full control, with the existing contrast warning kept as a safety net
   for that path specifically.

3. When a preset (or a valid advanced custom pair) is active, also derive and
   apply a matching accent tint for buttons/nav-highlights/links so they read
   as coordinated with the background rather than the current oxblood default
   clashing against an arbitrary custom color — extend applyCustomTheme() (or
   add a parallel function) to set --accent-from/--accent-to/--ox from the
   preset/derived value, following the same "the REAL gate is SettingsPage
   never writes it for Free users" pattern already documented in
   customTheme.ts's comments — don't add a new gate mechanism.

4. Keep the "glass and grain stay exactly the same" promise from the existing
   UI copy — don't touch --glass-fill/--glass-border here; the point is
   coordinating the color underneath, not redesigning the glass system.

5. Update the live preview panel at the bottom of SettingsPage to make the
   improvement obvious — it should now show body/muted/subtle text AND a
   sample button/highlight in the derived accent, so the preview actually
   demonstrates coordination, not just background+text.

6. Verify: every preset passes AA contrast via a quick script/test using
   src/lib/contrast.ts (add a small vitest if one doesn't already assert this),
   and manually check each preset in both Day and Night theme.

Follow the golden workflow: update memory.md, run typecheck/build/tests, commit
as `feat: curated custom-color presets, coordinated accent derivation`.
```

---

## Task 7 — Sync theme & personalization preferences across devices

**Session effort: Sonnet Medium thinking**
**Depends on:** ideally after Task 6, so you're syncing the improved preset-based settings, not the raw hex version. Not a hard blocker either way.

**Grounded in the code:** `profiles` table currently has `display_name`, `avatar_url`, `reminder_emails_enabled`, `reminder_lead_days`, `plan`, `dodo_customer_id` — no theme/personalization columns. Theme (`src/lib/theme.ts`) and custom personalization (`src/lib/customTheme.ts`) are both `localStorage`-only today, exactly as flagged in the strategy report (§7, §9 priority 6) and documented as a deliberate scope-cut in the code comments. This task closes that gap.

**Prompt to paste into a new session:**
```
Read memory.md, plan.md's data model section, and CLAUDE.md first. Then read
src/lib/theme.ts, src/lib/customTheme.ts, src/components/theme/ThemeProvider.tsx,
src/features/auth/useProfile.ts, and the profiles table definition in
src/types/database.ts.

Theme (Day/Night) and personalization (font pairing + custom colors) are both
localStorage-only today — a real, user-visible gap once someone uses Aurora on
more than one device. Sync them to the account:

1. Add a migration extending the `profiles` table with the new preference
   columns (e.g. `theme` text nullable, `custom_theme` jsonb nullable — mirror
   the shape of CustomThemeSettings in customTheme.ts). Follow the existing
   migration/RLS conventions exactly — this is an own-row-only table already,
   confirm the existing RLS policy already covers new columns on the same row
   (it should, since RLS is row-level not column-level) rather than assuming
   you need a new policy.

2. Extend useProfile.ts's ProfileUpdateInput/useUpdateProfile to read/write the
   new columns, following its existing optimistic-update pattern exactly.

3. The tricky part is boot sequence: theme is currently applied instantly,
   pre-first-paint (see the comments in ThemeProvider.tsx and how main.tsx
   calls applyTheme(getInitialTheme()) before React even mounts, specifically
   to avoid a flash). A network fetch to Supabase cannot block first paint the
   same way. The correct pattern: keep localStorage as the INSTANT-PAINT cache
   (unchanged — boot still reads localStorage synchronously, zero flash), then
   once the authenticated profile loads (useProfile), if the profile's stored
   theme/custom_theme differs from what's currently applied, reconcile:
   update local state + localStorage + re-apply, preferring the SERVER value
   once it's known (it represents "this account's last choice," which should
   win over a stale local cache from a previous device/session) — but do this
   as a smooth update, not a flash. Similarly, whenever the user changes theme
   or personalization settings while signed in, write to BOTH localStorage
   (instant local effect, unchanged) AND the profile (via useUpdateProfile) so
   another device picks it up on next load.
4. Handle the signed-out state gracefully — theme/personalization must still
   work exactly as today (localStorage-only) when there's no session; only
   sync once authenticated.

5. Manually test: change theme on one "device" (browser profile/incognito
   window signed into the same account), reload the other, confirm it picks up
   the change without a jarring flash-then-snap.

Follow the golden workflow: update memory.md, run typecheck/build/tests, commit
as `feat: sync theme and personalization preferences to account`.
```

---

## Task 8 — Calendar: borders, an explainer, and a couple of real enhancements

**Session effort: Sonnet Medium thinking**
**Depends on:** nothing.

**First, the explainer you asked for (what the calendar already does today):** the Calendar (`src/features/calendar/`) shows, on one unified month/week grid: every Kanban card with a due date (color-coded by its project's accent), your daily to-do lists (a done/total pill per day), and project milestones (a small flag icon). You can drag a card's chip from one day to another to reschedule it (optimistic, via dnd-kit). Clicking a chip opens the same card-detail modal used on the board. There's an ICS subscribe feed (Settings → Calendar sync, Pro-gated) — a stable HTTPS URL you paste into Google Calendar ("Other calendars → From URL"), Apple Calendar ("File → New Calendar Subscription"), or Outlook, and your due dates/to-dos/milestones then show up read-only inside that external calendar app, kept in sync automatically (it's a polling feed, not two-way — you can't create Aurora cards from inside Google Calendar, only see them). A "scope" filter lets you view one project or all of them at once; a toolbar switches between month and week views, with a touch-friendly agenda list on narrow phone screens instead of the grid.

**The borders bug, precisely:** `src/features/calendar/DayCell.tsx` renders each day with `border border-transparent` — a border exists in the markup but is invisible by default, only turning into a visible accent-colored ring during an active drag-over. That's why the grid currently looks borderless/flat.

**Prompt to paste into a new session:**
```
Read memory.md and CLAUDE.md first. Then read src/features/calendar/DayCell.tsx,
CalendarGrid.tsx, and CalendarPage.tsx.

Two things:

1. Fix the missing borders. DayCell.tsx currently sets `border
   border-transparent` on every cell (only becoming visible, in the accent
   color, during a drag-over). Give every day cell a subtle, always-visible
   hairline border using the existing design tokens (the --hair/border tokens
   already used elsewhere in the app for dividers — grep for how other
   glass panels/cards do hairline borders and match that exactly, don't invent
   a new border color). Also add a visual separator under the weekday header
   row (Mon/Tue/Wed…) in CalendarGrid.tsx so it reads as clearly separate from
   the day grid below it. Keep the existing drag-over accent-colored ring
   behavior on top of the new default border — it should still stand out
   during a drag. Check both Day and Night themes render this sensibly (the
   hairline must stay visible on both parchment and ink, not near-invisible on
   one of them).

2. Add these calendar enhancements, each small and additive — do not restructure
   the existing view/state logic more than necessary:
   a. A "Today" jump button in CalendarToolbar.tsx (if one doesn't already
      exist — check first) that resets the cursor to the current date; useful
      after navigating several months away.
   b. Make the "today" indicator more prominent — check DayCell.tsx's current
      today-badge styling and consider whether the whole cell (not just the
      date number) should get a subtle highlight/background tint so "today" is
      unmistakable at a glance across a full month grid, not just noticeable
      up close.
   c. In the per-day overflow ("+N more") and the DayCardsModal peek view,
      make sure to-dos and milestones are just as visible/clickable as cards —
      read DayCardsModal.tsx first to check whether it already surfaces these
      or only cards, and fix if it's card-only.
   Do not add anything bigger than these three (no new calendar "modes," no
   Gantt/timeline view — that's out of scope here; if you think of something
   bigger worth doing, note it in memory.md as a future idea instead of
   building it in this session).

Follow the golden workflow: update memory.md, run typecheck/build, commit as
`fix: visible calendar grid borders + today/overflow polish`.
```

---

## Task 9 — To-do & checklist drag-and-drop overhaul

**Session effort: Sonnet High thinking** (the trickiest interaction work in this whole plan — gesture conflicts and positioning correctness both matter)
**Depends on:** nothing, but benefits from Task 3 (analytics) existing so you can track how often reordering actually gets used.

**Grounded in the code, precisely what exists today vs. what's being asked for:**
- The Kanban **board** (`src/features/board/`) already has full, proven drag-and-drop for both cards AND columns, via `@dnd-kit` — `ordering.ts`'s fractional-position system (`positionBetween`, `rebalancedPositions`) is the pattern to reuse, not reinvent. This is very likely already what you saw as the drag handle (⋮⋮) next to "To Do"/"In Progress"/"Done" in your screenshots — so **column/board reordering may already work**; the next session should verify this first rather than assume it's missing.
- The **to-do list** (`src/features/todos/`) has NO drag-and-drop at all today — only up/down arrow buttons (`useMoveTodoItem`, a simple adjacent-swap, not the fractional system), and there is currently no "completed items sink to the bottom" behavior whatsoever — checking an item off leaves it exactly where it was.
- `TodoItemRow.tsx` already uses a horizontal Framer Motion drag gesture for swipe-to-complete/swipe-to-delete on touch devices. Any new vertical drag-to-reorder MUST coexist with this without fighting it — this is the single biggest risk in this task.

**Prompt to paste into a new session:**
```
Read memory.md, CLAUDE.md, and plan.md's relevant sections first. Then read
src/features/board/Board.tsx and src/features/board/ordering.ts in full (this
is the pattern to reuse), and src/features/todos/TodoListCard.tsx,
TodoItemRow.tsx, useTodos.ts, and the TodosPage that renders multiple
TodoListCards.

First, verify current behavior before changing anything: confirm whether
Kanban columns ("To Do"/"In Progress"/"Done") are already drag-reorderable
(Board.tsx has useMoveColumn + dnd-kit sortable — check if this is fully wired
and working, or partially). If columns are NOT already smoothly
drag-reorderable with good animation, fix that as part of this task too;
if they already work well, leave that code alone and focus on the to-do list
work below.

Build, for the to-do list and its items:

1. Switch item ordering from the current up/down-arrow adjacent-swap
   (useMoveTodoItem) to the same fractional-position system already proven in
   ordering.ts (positionBetween, byPosition, needsRebalance/rebalancedPositions)
   — move that logic to a shared location both board and todos can import from
   if it isn't already framework-agnostic, rather than duplicating it.

2. Add real drag-and-drop reordering of items within a TodoListCard using
   @dnd-kit (DndContext + SortableContext + useSortable), matching Board.tsx's
   sensor setup (MouseSensor/TouchSensor/KeyboardSensor) for consistency. Keep
   the existing up/down arrow buttons too — they're the accessible/keyboard
   fallback and some users will prefer them; don't remove functionality, add to
   it.

3. CRITICAL: the touch drag gesture must not conflict with TodoItemRow.tsx's
   existing horizontal swipe-to-complete/delete gesture. The standard fix is a
   dedicated drag handle (a small grip icon, visible on hover on desktop and
   always visible on touch) that owns the dnd-kit listeners, while the rest of
   the row keeps its existing horizontal swipe behavior untouched — do NOT make
   the whole row draggable on touch, that's what causes the conflict. Confirm
   this approach against dnd-kit's TouchSensor activation-constraint options
   (delay + tolerance) as a second layer of protection if a dedicated handle
   alone isn't enough.

4. Add "completed sinks to the bottom, but stays wherever the user drags it
   afterward" behavior: when an item is checked done, give it a one-time
   position update that places it after the last item in its priority tier
   (not a continuous re-sort every render — the current sort in
   TodoListCard.tsx is priority-tier first, position second; keep that
   structure, just also account for is_done by treating "done" as its own
   position-based demotion at the moment of toggling, not an ongoing sort
   criterion). Once demoted, the user can drag it anywhere afterward (including
   back above undone items) and it must stay there — verify this explicitly,
   it's the exact behavior requested and the easiest part to get subtly wrong.
   Unchecking an item should NOT automatically promote it back up — only the
   check action triggers the auto-move; the user manually repositions
   afterward in either direction.

5. Add drag-and-drop reordering of whole to-do LISTS (e.g. "Work" vs
   "Personal") on the day view, not just items within one list — same dnd-kit
   pattern, applied to whatever component renders multiple TodoListCards for a
   day.

6. Animation: this needs to feel "butter smooth," per explicit instruction —
   use dnd-kit's built-in transform/transition utilities plus Framer Motion's
   layout animations (motion.li with `layout`) so items smoothly slide into
   their new positions rather than snapping, matching the spring config
   already defined in src/lib/motion.ts (reuse it, don't invent new timing
   values). Respect prefers-reduced-motion via the existing pattern in this
   codebase.

7. Test thoroughly: reordering items within a list, reordering across priority
   tiers (should this be allowed via drag even though it's blocked via the
   arrow buttons today? — decide and document the choice in memory.md, then
   make the UI consistent with whatever you decide), checking an item off and
   confirming it sinks then stays wherever manually dragged, reordering whole
   lists, and the touch swipe-vs-drag-handle coexistence on an actual touch
   viewport (Chrome DevTools device emulation is enough).

Follow the golden workflow: update memory.md (including the priority-tier drag
decision from step 7), run typecheck/build/tests, commit as `feat: drag-and-drop
reordering for to-do items and lists, auto-sink completed items`.
```

---

## Task 10 — Table block for Notes and Canvas

**Session effort: Sonnet High thinking** (new UI surface, two integration points, real design-taste risk of scope creep)
**Depends on:** Task 1 (read SIMPLICITY-GUARDRAIL.md before starting — this is the task most likely to accidentally grow into "a database").

**Locked scope, from your brainstorm:** a plain table block usable in BOTH Notes and Canvas. Add/remove rows and columns, edit cell text, resize columns. Explicitly NOT in scope: formulas/computed cells, linked/relational records to cards or other tables, custom per-column field types (select, date, person, etc.), multiple views over one dataset, filtering/grouping. If you find yourself building any of those, stop — that's the "real mini-database" option you deliberately ruled out.

**Prompt to paste into a new session:**
```
Read memory.md, CLAUDE.md, and reports/SIMPLICITY-GUARDRAIL.md first (if that
file doesn't exist yet, read plan.md's design philosophy sections instead, and
flag in memory.md that the guardrail doc should be produced — see the
Improvement Plan's Task 1). Then read the Notes editor's Tiptap setup (find it
under src/features/notes/ — the extensions list, likely in a file that
configures useEditor/StarterKit) and the Canvas setup (src/features/canvas/,
Konva-based — find how existing node types like sticky notes/shapes are
rendered, dragged, and resized on the canvas).

Build ONE shared table block, usable in two places. Scope is deliberately
narrow — do not exceed it:
- Add/remove rows and columns
- Edit cell text (plain text only — no rich formatting inside cells beyond
  what's trivial to inherit)
- Resize columns (drag column border)
- A simple header-row style toggle is fine if it's cheap; nothing beyond that

Explicitly OUT of scope, do not build any of these even if they seem easy to
add along the way: formulas or computed cells, linking a table's rows to
Kanban cards or to other tables, per-column typed fields (select/date/
person/checkbox/number), multiple views over the same data, filter/sort/group
UI. If mid-session you think one of these is clearly needed, stop and note it
in memory.md as a proposal rather than building it — that decision belongs to
a deliberate future planning session, not this one.

1. In Notes: add the official Tiptap table extension set (@tiptap/extension-table
   + table-row + table-cell + table-header — check package.json, these may
   need adding as new dependencies) to the existing editor config. Wire it into
   whatever slash-command/toolbar/+-menu pattern Notes already uses for
   inserting other block types (find and match the existing pattern exactly —
   don't invent a new insertion UX). Style the table to match Aurora's
   aesthetic (Fraunces/Spectral typography, oxblood/accent header row, hairline
   borders matching DESIGN-GUIDELINES.md, not a generic browser-default table
   look).

2. On Canvas: add a new node type (mirroring how an existing node type, e.g. a
   sticky note or shape, is defined, rendered, dragged, and persisted in the
   Konva canvas code) that renders a small resizable grid — reuse the same
   underlying table-editing component/logic from step 1 if practical rather
   than building a second, separate table implementation; if the Tiptap table
   genuinely can't be embedded inside a Konva node (likely, since Konva renders
   to canvas, not DOM), build a lightweight standalone table component instead
   and share only the cell-data model/types between the two, not the rendering.
   Make sure it persists (position, size, and cell contents) the same way other
   canvas nodes already do — check the canvas's realtime/Yjs sync path, since
   canvas here is real-time collaborative (per CLAUDE.md) and a new node type
   must participate in that sync correctly, not just render locally.

3. Both integration points must work on mobile/touch (per CLAUDE.md's "every
   feature works on mobile and desktop" rule) — verify column resize and cell
   editing both work reasonably with touch input, not just mouse.

4. If Task 3 (analytics) exists in this repo already, add a
   table_inserted event with a `surface: 'notes' | 'canvas'` property.

Follow the golden workflow: update memory.md, run typecheck/build/tests, commit
as `feat: add table block to Notes and Canvas`.
```

---

## Task 11 — Guard against feature bloat: a standing checklist + audit pass

**Session effort: Sonnet Medium thinking**
**Depends on:** Task 1 (uses SIMPLICITY-GUARDRAIL.md directly — do this after, not before).

**What this actually is:** less a coding task, more turning your explicit anti-ClickUp mandate into something that outlives this one conversation — a living checklist plus one honest pass checking recent/current Aurora features against it.

**Prompt to paste into a new session:**
```
Read memory.md, CLAUDE.md, and reports/SIMPLICITY-GUARDRAIL.md (from an earlier
session — if it doesn't exist, stop and produce it first using the same brief
as Task 1 in the improvement plan, then continue). This session is documentation
and light housekeeping, not new features.

1. Add a short, permanent section to CLAUDE.md (not a new standalone file — this
   belongs in the rules file every session already reads) pointing to
   reports/SIMPLICITY-GUARDRAIL.md and stating plainly: every new feature
   proposal gets checked against it before being built, the same way security
   changes get checked against the RLS rules. Keep this addition short — a
   pointer and one sentence of why, not a restatement of the whole guardrail
   doc (CLAUDE.md's own rule is "keep these docs lean").

2. Do one honest audit pass: read through Aurora's current top-level navigation
   (Sidebar's nav items) and each page's primary UI, and check each surface
   against the guardrail checklist. Write findings to
   reports/SIMPLICITY-AUDIT-2026-08.md — for each item that fails a guardrail
   check, describe concretely what's confusing/heavy about it and a specific,
   small suggested simplification (not a redesign mandate — a suggestion). Be
   honest even about things built earlier in this same improvement plan (e.g.
   if the custom color presets from Task 6 or the table block from Task 10
   ended up adding more surface area than intended, say so).

3. Do NOT make sweeping UI changes in this session based on the audit —
   deciding what to act on is a separate, deliberate choice. This session's
   output is the checklist-is-now-a-standing-rule change to CLAUDE.md plus the
   honest audit document, nothing more.

Follow the golden workflow: update memory.md, commit as `docs: formalize
simplicity guardrail + first audit pass`.
```

---

## Task 12 — MCP connector: Aurora as an MCP server for Claude

**Session effort: Sonnet High thinking** (new architecture surface: auth, tool design, and correctness against RLS all matter)
**Depends on:** nothing structurally, but do this after the color/todo/table work above so the MCP tools it exposes reflect Aurora's finished shape rather than needing a second pass.

**Scope, per your answer:** Aurora ↔ Claude only in this task (the "connect to Claude the way Obsidian does" ask). Gmail/Outlook integration is explicitly a separate, later task — don't scope it in here.

**Prompt to paste into a new session:**
```
Read memory.md, CLAUDE.md (especially the security rules — RLS, anon key only,
never trust the client), and plan.md's data model first.

Build Aurora as an MCP server, so a user can connect Claude Desktop or Claude
Code to their own Aurora account and have Claude read and write their boards,
to-dos, and notes directly — the same shape of integration Obsidian offers via
its community MCP server. Research the current MCP server spec (the Model
Context Protocol — web-search for the current TypeScript SDK, current best
practices for auth in a remote/hosted MCP server as of 2026, since this changes
fast) before implementing, don't assume anything from training data about the
exact API shape.

Key design decisions to make deliberately, not by default:
1. Where does this run? Given Aurora is a Supabase-backed app with Cloudflare
   Pages hosting and Supabase Edge Functions already in use elsewhere in this
   codebase, the MCP server most likely belongs as a new Edge Function (or a
   small dedicated Cloudflare Worker, if that fits the existing deploy setup
   better — check how the other edge functions are deployed and follow that
   pattern rather than introducing a new hosting mechanism). It must NOT run
   as client-side code — this needs to authenticate a real user and act with
   their real permissions server-side.

2. Auth: a user needs to explicitly connect their Aurora account to their
   Claude client. Do not reuse the app's regular session/password auth for
   this — design a scoped, revocable mechanism (e.g. a personal access token
   the user generates from Settings, stored hashed server-side, similar in
   spirit to how the existing calendar ICS feed token in
   src/features/calendar-feed/ works as a precedent already in this codebase —
   read that feature's implementation as a reference pattern for "a
   user-generated, revocable, scoped access token"). Every MCP tool call must
   run with that user's actual RLS permissions — never bypass RLS with a
   service-role shortcut for convenience.

3. Tools to expose, kept deliberately small and well-scoped for a first
   version (expand later, don't over-build now): list_projects,
   list_board_cards(project_id), create_card(project_id, column, title,
   ...), update_card(card_id, ...), list_todos(date), add_todo_item(...),
   toggle_todo_item(id, done), list_notes(project_id), read_note(note_id),
   append_to_note(note_id, content). Each tool's input schema should be
   tightly typed and validated with Zod, matching this codebase's existing
   validation conventions.

4. A settings UI: a new section in SettingsPage.tsx (or its own small page)
   where the user generates/revokes their MCP access token and sees the exact
   connection instructions/config snippet to paste into Claude Desktop's MCP
   config, following whatever the current (2026) standard config format is —
   verify this via the same web research from the top of this prompt, don't
   guess the JSON shape from memory.

5. Rate-limit this the same way other edge functions in this repo already are
   — an MCP server that can be hit repeatedly by an agentic client is a
   realistic abuse surface, treat it with the same care as the billing
   webhooks.

6. Write clear setup docs (a new SETUP-MCP.md or a section in the existing
   SETUP.md — check which fits better) covering both the user-facing "how do I
   connect Claude to my Aurora" steps and enough technical detail for you to
   remember how it works in six months.

This is genuinely new architecture for this codebase — go slower and more
carefully than usual, and if the MCP spec research turns up something that
changes the recommended approach above, follow the research, not this prompt's
assumptions.

Follow the golden workflow: update memory.md thoroughly (this is exactly the
kind of decision that needs a clear record), run typecheck/build/tests, commit
as `feat: Aurora MCP server — connect Claude Desktop/Code to your account`.
```

---

## Task 13 — Solo-maintainer "bus factor" runbook

**Session effort: Sonnet Medium thinking** (thoroughness matters more than cleverness — this is a documentation task)
**Depends on:** do this after everything else above, per your explicit instruction — it should describe the FINISHED state, not a half-built one.

**Prompt to paste into a new session:**
```
Read memory.md, CLAUDE.md, plan.md, SETUP.md, and skim the supabase/functions
and supabase/migrations directories first, so this document reflects the
actual current state of the project, not an assumed one.

Write a single, concrete "if I disappear tomorrow" runbook — reports/
BUS-FACTOR-RUNBOOK.md. This is not a general architecture doc (plan.md already
covers that) — it's specifically the operational knowledge that currently
exists only in one person's head, written down so someone else (or future-you,
after months away) could pick this up cold. Cover, concretely and specifically
(with actual names/locations, not placeholders):

1. Where every secret/credential lives: Supabase project ref and where its
   keys/service role are stored, Dodo Payments account access, Cloudflare
   Pages/DNS access, Resend (email) account access, the GitHub repo/remote,
   and anything in .env / Cloudflare env vars / Supabase Edge secrets —
   list what exists without printing the actual secret values into this
   document.
2. How to redeploy from scratch if the current machine/environment is lost:
   clone steps, required env vars (reference .env.example), build/deploy
   commands, and which services (Cloudflare Pages, Supabase) need to be
   reconnected and how.
3. Who/what to contact if each third-party service has an outage or billing
   issue: Dodo Payments, Supabase, Cloudflare, Resend — support channels,
   account email used to sign up, any account IDs worth recording.
4. The migration history / how schema changes are applied (supabase/migrations
   — the CLI workflow already used in this project).
5. A short "if something is on fire" section: where logs/errors actually
   surface today (Cloudflare, Supabase logs, Sentry if it exists — check), and
   the fastest path to rolling back a bad deploy.
6. Point to the existing docs rather than duplicating them — memory.md for
   current state, plan.md for architecture, CLAUDE.md for workflow rules; this
   runbook's job is specifically the "who has access to what, and how do I get
   back in" knowledge those docs don't cover.

Keep it scannable — headers, short lists, no prose padding. Someone reading this
under stress (an actual emergency) needs to find the right section in seconds.

Follow the golden workflow: update memory.md, commit as `docs: add solo-maintainer
bus-factor runbook`.
```

---

## Task 14 — Pentest: commission it (last piece of actual product work)

**Session effort: Sonnet Low-Medium thinking** (mostly coordination/process, not code — but the pre-pentest checklist benefits from care)
**Depends on:** everything else above should be done first, per your explicit instruction, since the point is testing the finished surface area, not a half-built one.

**Context:** already scoped in `reports/Aurora_Penetration_Test_Options_Report.pdf` at a $4,000-$8,000 band (boutique/PTaaS firm, gray-box, multi-tenant-isolation-focused) — this was a prior internal report, not something that needs re-researching from scratch. This task is about actually commissioning it and making sure the codebase is in the best possible shape going in.

**Prompt to paste into a new session:**
```
Read memory.md, CLAUDE.md's security rules, and reports/
Aurora_Penetration_Test_Options_Report.pdf first (already scoped: $4k-$8k,
boutique/PTaaS firm, gray-box, multi-tenant-isolation-focused — don't
re-research vendor options from zero, that report already did this).

This session has two parts:

1. Pre-pentest hardening pass: run the existing pgTAP RLS regression suite and
   any other security-relevant tests/lints in this repo, confirm they're all
   green. Do a fresh read-through of every RLS policy and SECURITY DEFINER
   function added or changed since REMEDIATION-PLAN.md / PHASE-7-VERIFICATION.md
   were written (check migration timestamps against those docs' dates), since
   this improvement plan has likely added new tables/functions (analytics
   events, MCP tokens, synced preferences) that need the same RLS rigor as
   everything else — audit those specifically, they're the newest, least
   battle-tested surface area. Fix anything found; if nothing is found, say so
   explicitly in the write-up rather than silently doing nothing.

2. Write reports/PENTEST-READINESS-2026.md: a short pre-engagement brief a
   boutique security firm could actually use to scope the engagement quickly —
   what Aurora is, the tech stack, what's already been done internally
   (RLS everywhere, the remediation phases, the pgTAP suite), and a clear list
   of what's new/highest-risk since the last review (name the specific
   features from this improvement plan: MCP server auth, the new analytics
   endpoint, synced preferences) so the firm can focus effort there rather than
   re-testing already-hardened ground from zero.

Do not attempt to actually hire/contact a vendor from within this session —
that's a real-world action for you to take using the readiness doc; this
session's job is making sure the codebase and the brief are both ready.

Follow the golden workflow: update memory.md, commit as `docs: pre-pentest
hardening pass and readiness brief`.
```

---

## Task 15 — Marketing plan (separate future session, after everything above)

**Session effort: Sonnet Medium-High thinking**
**Depends on:** literally everything else in this plan — you were explicit this is tackled last, in its own new session, once the product itself is in its finished state.

**Note for when you get there:** the existing `reports/Aurora_Full_Strategy_Report_2026-08-13.html` already has a full marketing strategy section (§10) with channel-by-channel research, a 90-day budget, and message-testing angles — that session shouldn't start from zero, it should treat that section as the draft and turn it into the dedicated, more detailed pre-launch/post-launch marketing plan HTML you asked for, refreshing anything that's changed in the meantime (pricing, feature set, what's actually shipped vs. planned by then). I'm not writing that session's prompt now since you asked for this to be planned fresh, later, once the rest of this list is done and the product's real shape by then is known — writing a detailed prompt for it today would be guessing at a moving target.

---

## Task 16 — Time tracking (start/stop, per card)

**Session effort: Sonnet Medium thinking**
**Depends on:** nothing structurally; benefits from Task 3 (analytics) existing so a `time_entry_started`/`stopped` event can be added in the same pass.

**From reports/FEATURE-GAP-ANALYSIS.md #1:** the single most consistently cited freelancer need in the Aug 2026 competitor research — freelancers bill by the hour and currently juggle a separate timer app. Deliberately scoped narrow: a running total, not a billing system.

**Prompt to paste into a new session:**
```
Read memory.md, CLAUDE.md, and reports/FEATURE-GAP-ANALYSIS.md (item #1) first.
Then read src/features/board/CardDetailModal.tsx and cardExtras.api.ts to see
the existing pattern for a per-card extras section (checklist/labels) and its
RLS-governed data layer.

Add simple time tracking to Kanban cards:

1. A new `time_entries` table (id, card_id, user_id, started_at, ended_at
   nullable — null means "currently running", plus whatever else the existing
   migration conventions in supabase/migrations use). RLS mirrors
   checklist_items: governed by project membership via the same
   is_project_member() SECURITY DEFINER helper (plan.md §6) — a user can only
   read/write time entries on cards in projects they belong to; a user can only
   start/stop their OWN entries (auth.uid() = user_id on insert/update).

2. In CardDetailModal.tsx, add a small "Time" section (mirrors the Checklist
   section's placement/styling): a start/stop button showing a live-ticking
   elapsed time while running, and a running total for the card (sum of all
   entries, formatted h:mm). Keep this to ONE active entry per user per card at
   a time — starting a new timer while one is running should stop the old one,
   not create overlapping entries.

3. If src/lib/analytics.ts exists (Task 3), track time_entry_started/stopped
   with the card's project_id as a property; if it doesn't exist yet, skip this
   step rather than building a parallel tracking mechanism.

Explicitly OUT of scope for this session: billable rates, invoicing, timesheet
reports/exports, and tracking on to-do items (cards only, v1). If any of these
feel necessary while building, stop and note it in memory.md as a future
proposal instead.

Follow the golden workflow: update memory.md, run typecheck/build/tests, commit
as `feat: add per-card time tracking (start/stop, running total)`.
```

---

## Task 17 — Client-facing read-only share link (no account required)

**Session effort: Sonnet High thinking** (new, unauthenticated read path through RLS — go carefully)
**Depends on:** nothing structurally, but read Task 12's MCP token design first if that session has already happened, so the two revocable-token mechanisms in this codebase stay consistent with each other.

**From reports/FEATURE-GAP-ANALYSIS.md #2:** confirmed as a genuine gap, not an overlap — `src/features/sharing/` (SharePanel.tsx, api.ts) only invites *registered Aurora users* by email as editor/viewer collaborators on a note or canvas. There is no unauthenticated, view-only link a freelancer can hand a client. This is new territory: the first place in this app an anonymous visitor needs to read real project data.

**Prompt to paste into a new session:**
```
Read memory.md, CLAUDE.md's security rules (RLS, anon key only, never trust the
client), and plan.md's security model section first. Then read
src/features/calendar-feed/api.ts and the calendar-feed-token /
calendar-feed Edge Functions under supabase/functions/ — this is the existing
precedent in this codebase for "a revocable, unauthenticated, token-scoped read
path" (a random token stored server-side, an Edge Function that serves data by
token without a logged-in session) — follow that pattern's shape rather than
inventing a new one.

Build a read-only, no-login-required share link for a project:

1. A new `project_share_links` table (id, project_id, token, created_by,
   revoked_at nullable, created_at). Only the project owner can create/revoke
   one (RLS + a SECURITY DEFINER function, matching the project_is_member
   helper pattern). Never expose the raw token except at creation time in the
   response, same discipline as the calendar feed token.

2. A public route, e.g. /share/:token, that renders a stripped-down read-only
   view of the board (columns + cards + labels + due dates — no comments
   thread, no edit affordances, no member list, no billing/settings surface
   reachable from it) and validates the token server-side via an Edge Function
   or a SECURITY DEFINER RPC callable with the anon key — never via a client-
   side RLS policy that trusts an unauthenticated `token` query param directly
   in Postgres RLS (the anon key has no per-request identity to scope that
   safely; go through a function that validates the token and returns data
   explicitly, the same shape as the calendar-feed function).

3. A "Share (read-only)" affordance in the existing SharePanel.tsx or ProjectPage
   menu that creates/copies/revokes the link — reuse the visual language already
   established there rather than a new pattern.

4. Rate-limit the public route/function (mirror the pattern already used by
   other edge functions in this repo) since it's now reachable by anyone with
   the link, not just authenticated users.

Follow the golden workflow: update memory.md thoroughly (this is new
architecture — record the token-validation approach clearly), run
typecheck/build/tests, commit as `feat: add read-only client share links for
projects`.
```

---

## Task 18 — File attachments on cards

**Session effort: Sonnet Medium thinking**
**Depends on:** nothing structurally.

**From reports/FEATURE-GAP-ANALYSIS.md #3:** attaching a contract, mockup, or reference file directly to a task is baseline expectation across every competitor studied; Aurora has no attachment path on cards today (only checklist items and labels). Notes/canvas already solved the hard part of this — a private Storage bucket + signed URLs + RLS — this task reuses that pattern rather than inventing one.

**Prompt to paste into a new session:**
```
Read memory.md, CLAUDE.md's security rules, and plan.md's data model first.
Then find and read how the `note-media` Storage bucket is set up and RLS-gated
(grep supabase/migrations and supabase config for "note-media" or "note_media")
— that's the exact pattern to mirror for this task.

Add file attachments to Kanban cards:

1. A new private Storage bucket, e.g. `card-attachments`, with RLS/policies
   gated by project membership (read) and editor role (write/delete) —
   matching note-media's policy shape.

2. A new `card_attachments` table (id, card_id, uploader_id, storage_path,
   file_name, mime_type, size_bytes, created_at), RLS via the same
   is_project_member() helper used elsewhere.

3. In CardDetailModal.tsx, add an "Attachments" section (same placement
   pattern as Checklist/Labels/Time): drag-drop or file-picker upload, a
   thumbnail preview for images and a generic file icon + name/size for
   everything else, download via a signed URL, delete gated to the uploader or
   a project editor/owner.

4. Enforce a sane per-file size cap client-side (Zod/UI validation) AND via the
   Storage bucket's own size limit config — don't rely on the client alone.

If Task 3 (analytics) exists, track an `attachment_uploaded` event with
file type/size as properties.

Follow the golden workflow: update memory.md, run typecheck/build/tests, commit
as `feat: add file attachments to Kanban cards`.
```

---

## Task 19 — Starter templates for new projects, PLUS a "save as template" custom template builder

**Session effort: Sonnet High thinking** (the builder half is a real UX-design problem, not just CRUD — it needs to feel effortless, not like filling out a form)
**Depends on:** Task 1 (read reports/SIMPLICITY-GUARDRAIL.md first — this is the task most likely to accidentally grow into a second onboarding flow if not kept disciplined).

**From reports/FEATURE-GAP-ANALYSIS.md #4, expanded per your direction:** the original brief was curated system templates only. You've asked for more: a genuine custom template builder, and it needs to be "amazing to use" — not a bolt-on form. The way to hit both "amazing" and "still simple" at once is to make the *authoring* model as close to zero-effort as the *using* model: a template isn't built in an abstract builder UI, it's saved directly from a real project the user already built and likes. This mirrors the curated-grid pattern `AccentPicker.tsx` already uses (a handful of good-looking, pre-vetted options presented as a grid, never a blank form) and reuses `src/features/todos/starterTemplates.ts` as the existing precedent for curated starter content in this codebase.

**Prompt to paste into a new session:**
```
Read memory.md, CLAUDE.md, and reports/SIMPLICITY-GUARDRAIL.md first. Then read
src/features/todos/starterTemplates.ts (the existing curated-template
precedent), src/features/projects/AccentPicker.tsx (the curated-grid UI
precedent to match visually), src/features/projects/ProjectFormModal.tsx
(today's "New project" flow), and src/features/board/ordering.ts (for
positionBetween — templates need to seed columns/cards with correct
fractional positions, not just insert in arbitrary order).

Part A — curated system templates:
1. Design 5-8 curated starter templates (e.g. "Freelance client project,"
   "Content calendar," "Simple sprint board," "Personal goals tracker," "Event
   planning") as structured data: a column set + a handful of realistic
   starter cards (title + optional checklist skeleton + optional labels — no
   assignees/due dates/comments, those are per-instance). Keep the total
   template count small and genuinely curated, not a long catalog.
2. In the "New project" flow, add a template picker: a grid of preview cards
   (name, icon/accent, a short one-line description, maybe a tiny column-name
   preview) in AccentPicker's visual language. "Blank project" is ALWAYS the
   first option and the flow's implicit default — never force a template
   choice before a project can be created.
3. Selecting a template shows a lightweight live preview (the columns it will
   create, how many starter cards) before the user commits, then "Use this
   template" instantiates instantly with a spring transition into the new
   board.

Part B — the "save as template" builder (the actual ask: a custom template
builder that's amazing to use):
4. Add a `project_templates` table (id, owner_id, name, description?, icon?,
   source: 'system' | 'user', payload jsonb capturing the column set + starter
   card skeletons — same shape as the system templates' data, NOT a live copy
   of real due dates/assignees/comments/attachments). RLS: a user can only see
   and use their own `source: 'user'` templates (plus all `source: 'system'`
   ones, readable by everyone).
5. Add "Save as template" to ProjectPage's menu (wherever its overflow/settings
   menu already lives — match the existing menu pattern exactly). This is the
   ENTIRE authoring UI: no separate template-builder screen, no field-by-field
   configuration wizard. Clicking it captures the project's current columns +
   card titles/checklists/labels into a payload, asks for just a name (+
   optional icon/description, matching the New Project modal's own minimal
   field set), and saves. That's the whole "builder" — the user already built
   the real thing; this just snapshots it.
6. The New Project template picker now shows "My templates" as a second
   section below the curated system ones, same grid/preview/instant-use
   interaction as Part A. Support rename/delete of a user's own templates from
   there or from Settings — whichever fits the existing settings-page pattern
   better.

Explicitly OUT of scope even though it might feel natural to add: no template
sharing/marketplace between different Aurora accounts, no versioning/template
history, no field-by-field template editor UI (editing a template happens by
adjusting a real project and re-saving, not by editing the template's raw
data). If you're tempted to build any of these, stop and note it in memory.md
as a future idea instead.

Follow the golden workflow: update memory.md — including a short note that this
expands on Task 1's original curated-only recommendation into a full builder
per an explicit product decision — run typecheck/build/tests, commit as `feat:
starter project templates + save-as-template builder`.
```

---

## Task 20 — Full-text search across card and note content

**Session effort: Sonnet Medium thinking**
**Depends on:** nothing.

**From reports/FEATURE-GAP-ANALYSIS.md #5:** the command palette (⌘K) today indexes project/note/canvas/folder *names* for navigation, filtering already-loaded TanStack caches client-side — it doesn't search the *content* inside cards or notes, and doesn't hit the database at all. This task is the first time the palette needs a live query rather than a client-side filter — call that out explicitly since it changes the component's architecture, not just its result list.

**Prompt to paste into a new session:**
```
Read memory.md and CLAUDE.md first. Then read
src/features/command-palette/CommandPalette.tsx and paletteStore.ts in full —
note today's search is entirely client-side, filtering data already sitting in
TanStack Query caches (useProjects, useFolders, useLibraryNotes, useAllCanvases).
This task adds the first server-side, query-as-you-type result source to the
palette, so read this file carefully before changing it.

1. Add Postgres full-text search (tsvector generated column, or pg_trgm if
   fuzzy/partial matching is preferred — decide based on what's already used
   elsewhere in this codebase's migrations, if anything) over `cards.title` +
   `cards.description` and `notes.content` (the plain-text mirror column, not
   content_json). RLS on the search RPC must respect the same project/note
   membership rules as everything else — a search can never return a row the
   caller couldn't otherwise read.

2. Wire a debounced (e.g. 200-300ms) query into CommandPalette.tsx that fires
   only once the user has typed a few characters, shown as a new "Content
   matches" section in the results list below the existing instant client-side
   navigation matches — keep the existing instant results feeling instant;
   only the new content-search section should show a brief loading state.

3. Selecting a content match navigates to and opens the specific card or note
   (deep-link into the board/note, not just the project).

4. Respect the existing MAX_RESULTS cap so a large workspace can't flood the
   panel; this likely needs its own smaller cap for the content-search section
   specifically since DB round-trips are more expensive than the existing
   in-memory filtering.

Follow the golden workflow: update memory.md, run typecheck/build/tests, commit
as `feat: full-text search across cards and notes in the command palette`.
```

---

## Task 21 — One-time import from Trello / CSV

**Session effort: Sonnet Medium-High thinking**
**Depends on:** nothing.

**From reports/FEATURE-GAP-ANALYSIS.md #6:** the strategy report already identified high "tool churn" in this category as Aurora's biggest acquisition opportunity. The single biggest friction point for someone switching tools is manually re-creating their existing boards. A one-time importer directly lowers that cost.

**Prompt to paste into a new session:**
```
Read memory.md and CLAUDE.md first. Then read src/features/board/api.ts and
ordering.ts (positionBetween) for the existing card/column creation and
ordering patterns to reuse — this importer inserts through the normal
authenticated Supabase calls other creation flows already use, respecting RLS,
not through a service-role bypass.

Build a one-time "Import" flow (a modal reachable from ProjectsPage or Settings):

1. Support two input shapes: a Trello board JSON export (Trello's
   "Menu → Print, export, and share → Export as JSON" format — look up the
   current field shape rather than assuming) and a generic CSV with columns
   like List, Card Title, Description, Due Date, Labels.

2. Parse client-side into an Aurora project: each Trello list / CSV "List"
   value becomes a column, each row/card becomes a card, using
   positionBetween for correct fractional ordering (don't just increment
   integers). Map Trello labels to Aurora labels where names match; ignore
   fields Aurora doesn't have (Trello Power-Up data, checklists nested deeper
   than one level, etc. — note anything skipped in a post-import summary
   rather than silently dropping it).

3. Batch the inserts sensibly for large boards (don't fire hundreds of
   sequential single-row inserts) and show real progress, not a spinner with
   no feedback — imports can take a few seconds for a big board.

4. This is one-way and one-time: no ongoing sync back to Trello, no "re-import"
   diffing. Make that explicit in the UI copy so it isn't mistaken for a live
   integration.

If Task 3 (analytics) exists, track an `import_completed` event with source
('trello' | 'csv') and card count.

Follow the golden workflow: update memory.md, run typecheck/build/tests, commit
as `feat: one-time Trello/CSV import`.
```

---

## Task 22 — Recurring Kanban cards

**Session effort: Sonnet Medium thinking**
**Depends on:** nothing structurally, but reuses Task 9's shared-ordering refactor if that's landed already.

**From reports/FEATURE-GAP-ANALYSIS.md #7:** the to-do planner already has real recurrence (src/features/todos/recurrence.ts); board cards don't. Small teams have recurring board-level work too — a monthly retainer task, a weekly content card — that currently has to be manually re-created each cycle. This is substantially "wire the existing recurrence engine to a second table," not new architecture.

**Prompt to paste into a new session:**
```
Read memory.md and CLAUDE.md first. Then read
src/features/todos/recurrence.ts and recurringTemplates.ts in full (the
engine to reuse — extract it to a shared, framework-agnostic location both
todos and board can import from if it isn't already, rather than duplicating
the recurrence-rule logic). Also read supabase/functions/send-due-reminders
(the existing reminders cron) as the precedent for how a scheduled Edge
Function is deployed and triggered in this codebase — recurring card creation
needs the same kind of cron, not a client-side timer.

1. Add a nullable `recurrence_rule` jsonb column to `cards`, same shape as
   whatever todos already use for their recurrence rules (reuse the type, don't
   invent a second schema for the same concept).

2. Add recurrence controls to CardDetailModal.tsx (mirrors
   RecurrenceEditor.tsx from todos — reuse that component if it's already
   reasonably generic, adapt it if it's todo-specific).

3. A scheduled Edge Function (new, or extending send-due-reminders if that
   makes more sense architecturally — decide and say why) that finds cards with
   an active recurrence rule whose next occurrence is due, and creates the next
   card instance (fresh checklist state, no carried-over comments/attachments/
   time entries from the previous occurrence — a genuinely new card, not a
   duplicate of the old one's activity).

Follow the golden workflow: update memory.md, run typecheck/build/tests, commit
as `feat: recurring Kanban cards`.
```

---

## Task 23 — Rule-builder automations (Pro & Team plans only)

**Session effort: Sonnet High thinking** (new execution surface — rules must fire correctly and safely even with no client connected)
**Depends on:** Task 1's guardrail doc, specifically to read the note below before starting.

**Explicit decision, overriding Task 1's own recommendation:** `reports/SIMPLICITY-GUARDRAIL.md` and `reports/FEATURE-GAP-ANALYSIS.md` both flagged rule-builder automations as the single most direct path to ClickUp/Monday-style "feature overload" complaints found in the Aug 2026 research. You've reviewed that and decided to build it anyway — **gated entirely to Pro and Team plans**, which is the mitigation: a first-time user on the free plan (the audience the overwhelm research is about) never sees this surface at all. Keep the gate hard, not just a visual nudge — this needs to be genuinely invisible below Pro, not a greyed-out teaser that itself adds clutter to the free experience.

**Prompt to paste into a new session:**
```
Read memory.md, CLAUDE.md (security rules), reports/SIMPLICITY-GUARDRAIL.md,
and reports/FEATURE-GAP-ANALYSIS.md's "flagged as bloat risk" section first —
this task deliberately builds something that section advised against; read why
before starting so the mitigation (hard Pro/Team gating, a constrained rule
shape) is applied deliberately, not lost along the way. Then read
src/features/collaboration/useProjectIsPro.ts and wherever <ProGate> is
defined (grep for it) — this is the exact gating pattern to reuse, matching how
canvas and custom colors are already Pro-gated. Also read
src/features/board/cardExtras.api.ts and ordering.ts for how card mutations are
normally performed.

Build a deliberately small, constrained automation system — NOT an open rule
builder with arbitrary triggers/conditions/actions:

1. A new `automation_rules` table (id, project_id, trigger_type, trigger_config
   jsonb, action_type, action_config jsonb, enabled, created_by, created_at).
   Fix the trigger/action types to a small enum, don't design an extensible
   plugin system:
   - Triggers: card moved to a specific column, checklist reaches 100%
     complete, due date passes.
   - Actions: move card to a specific column, add a specific label, assign to
     a specific user.
   That's it for v1 — two dropdowns and a target picker per rule, not a visual
   flowchart canvas or a scripting surface.

2. RLS: automation_rules are governed by project_is_pro() (the same helper
   used elsewhere) AND project membership — creating/editing a rule requires
   Pro/Team on the project AND editor role; a rule stops firing (but isn't
   deleted) if the governing plan lapses, mirroring the canvas Pro-gating
   pattern in plan.md §6.

3. Execution: decide deliberately between a Postgres trigger (fires
   server-side even with no client connected — the safer default for
   "checklist reached 100%" and "due date passed" triggers) vs. an Edge
   Function invoked from the client on the relevant action (simpler, but only
   fires if a client happens to trigger the mutation). Recommend a DB trigger
   for correctness; document whichever you choose and why in memory.md.

4. UI: a "Automations" section inside the Project's settings/overflow menu
   (NOT a new Sidebar nav item — per the guardrail's nav-cost question), fully
   hidden (not shown-but-disabled) for non-Pro projects. Each rule renders as
   one readable sentence ("When a card moves to Done, assign it to nobody" /
   "When a checklist hits 100%, move the card to Done") — never raw
   trigger/action JSON in the UI.

5. Rate-limit rule creation/edits the same way other write paths in this repo
   are protected against abuse.

Follow the golden workflow: update memory.md — explicitly recording that this
overrides the guardrail's advisory flag, and why the Pro/Team gate is the
mitigation — run typecheck/build/tests, commit as `feat: rule-builder
automations (Pro/Team)`.
```

---

## Task 24 — Goals tracking (a simple version of OKRs, not the enterprise kind)

**Session effort: Sonnet Medium-High thinking**
**Depends on:** Task 1's guardrail doc.

**Explicit decision, overriding Task 1's own recommendation:** flagged in `reports/FEATURE-GAP-ANALYSIS.md` as having little pull for freelancers/small teams and skipped. You've decided to add it. The mitigation here is scope, not gating: build "Goals with a progress bar," not enterprise OKRs — no Objectives/Key-Results split, no cascading/nested goal hierarchies, no quarterly cycles UI. If it can't be explained in one plain sentence to a first-time user (guardrail item 4), it's over-scoped for this task.

**Prompt to paste into a new session:**
```
Read memory.md, CLAUDE.md, and reports/SIMPLICITY-GUARDRAIL.md first. Then read
ProjectPage.tsx to see how its existing tabs/sections are laid out — this
feature should live as a new section/tab INSIDE the project page, not a new
Sidebar nav item (guardrail item 1).

Build a simple goals module:

1. A new `goals` table (id, project_id, owner_id, title, description?,
   target_date?, progress_type: 'manual_percent' | 'linked_checklist', progress
   value or a link to specific checklist items whose completion rolls the
   progress up automatically, created_at). Keep the data model flat — one goal,
   one progress bar, no parent/child goal relationships.

2. UI: a "Goals" tab/section on the project page — a flat list of goals, each
   showing title, target date if set, and a progress bar. Creating a goal is a
   small form (title + optional target date + either a manual percentage slider
   or "link to a checklist" picker) — no more fields than that.

3. For linked_checklist goals, progress is computed automatically (checked
   items / total) so the "amazing to use" bar is a goal that updates itself as
   the team works, not something anyone has to remember to move by hand — lean
   toward this mode being the default suggestion in the UI over manual percent.

4. Plain language throughout: "Goal," "Progress," "Target date" — never
   "Objective," "Key Result," or "OKR" in the UI copy, even though that's the
   feature's informal name in this plan.

Follow the golden workflow: update memory.md — explicitly recording that this
overrides the guardrail's advisory flag, and that the scope mitigation is
"goals with a progress bar," not enterprise OKRs — run typecheck/build/tests,
commit as `feat: add simple goals tracking to projects`.
```

---

## Task 25 — Timeline / Gantt view

**Session effort: Sonnet High thinking** (a genuinely new view mode with its own drag-reschedule interaction)
**Depends on:** Task 1's guardrail doc; do after Task 8 (calendar borders/polish) lands so this doesn't build on top of calendar UI that's mid-fix.

**Explicit decision, overriding Task 1's own recommendation:** flagged as a "someday, if users ask" item, not a roadmap slot, since it's real ongoing surface area to maintain. You've decided to build it now. The mitigation is placement and scope: this must not become a fourth top-level destination or a dependency/critical-path system (that's separately flagged as its own rejected bloat item) — it's a new way to *look at* the same due-date data Calendar already shows, reached via a view toggle, not a new concept.

**Prompt to paste into a new session:**
```
Read memory.md, CLAUDE.md, and reports/SIMPLICITY-GUARDRAIL.md first. Then read
src/features/calendar/CalendarGrid.tsx and DayCell.tsx (confirm Task 8's border
fixes have landed first — build on top of the fixed version, not the
pre-fix one) and src/features/board/Board.tsx's dnd-kit sensor setup (for the
horizontal-drag reschedule interaction this needs).

Build a Timeline/Gantt view:

1. Add a nullable `cards.start_date` column — a Gantt bar needs a start AND an
   end (the existing due_date), not just one date. Cards without a start_date
   can still render (as a single-point marker on their due date, or simply
   excluded from the timeline with a note — decide and document which).

2. A new view mode reached via a toggle inside the EXISTING Calendar or Board
   toolbar (whichever fits better architecturally — decide and say why), not a
   new Sidebar item. Renders cards as horizontal bars across a date axis,
   color-coded by project accent (matching Calendar's existing convention),
   grouped by project or column (decide which reads clearer and document it).

3. Dragging a bar's edges reschedules start/due dates; dragging the whole bar
   moves both dates together — same optimistic-update, dnd-kit-based
   interaction pattern Calendar already uses for rescheduling.

Explicitly OUT of scope for v1, even though real Gantt tools have them: task
dependencies/critical path (a separately flagged rejected feature — do not
build linking between bars), resource leveling, baseline/variance tracking. If
any of these feel necessary while building, stop and note it in memory.md as a
future idea instead.

Follow the golden workflow: update memory.md — explicitly recording that this
overrides the guardrail's advisory flag, and that the scope mitigation is "a
new lens on existing due-date data, no dependencies" — run
typecheck/build/tests, commit as `feat: add timeline/Gantt view`.
```

---

## Summary table

| # | Task | Effort | Notes |
|---|---|---|---|
| 1 | Competitor research + Simplicity Guardrail doc | Medium | Do first — feeds #10, #11, #16-25 |
| 2 | Remove leftover pre-rebrand font deps | Low | 15-minute cleanup |
| 3 | Minimal funnel analytics | High | Report's #1 priority; do early so later tasks add one call each |
| 4 | Add to Home Screen button | Medium | PWA is already fully configured |
| 5 | Full immersive per-project color re-theme | High | Separate session from #6 |
| 6 | Redesign custom color personalization | High | Separate session from #5 |
| 7 | Sync theme/personalization to account | Medium | Do after #6 ideally |
| 8 | Calendar borders + explainer + small enhancements | Medium | Do before #25 |
| 9 | To-do/checklist drag-and-drop overhaul | High | Trickiest interaction work here |
| 10 | Table block (Notes + Canvas) | High | Strictly scoped — no formulas/relations |
| 11 | Feature-bloat guardrail + audit | Medium | After #1 |
| 12 | MCP connector — Aurora ↔ Claude | High | Gmail/Outlook explicitly deferred |
| 13 | Bus-factor runbook | Medium | Very end, per your instruction |
| 14 | Pentest commissioning + readiness | Low-Medium | LAST piece of product work, per your instruction |
| 15 | Marketing plan HTML | Medium-High | Separate future session, after all of the above |
| 16 | Time tracking (start/stop, per card) | Medium | From gap analysis #1 |
| 17 | Client-facing read-only share link | High | From gap analysis #2; new unauthenticated read path |
| 18 | File attachments on cards | Medium | From gap analysis #3; mirrors note-media pattern |
| 19 | Starter templates + custom template builder | High | From gap analysis #4, expanded per your direction |
| 20 | Full-text search (cards + notes) in command palette | Medium | From gap analysis #5 |
| 21 | One-time Trello/CSV import | Medium-High | From gap analysis #6 |
| 22 | Recurring Kanban cards | Medium | From gap analysis #7 |
| 23 | Rule-builder automations (Pro/Team only) | High | Overrides guardrail's advisory flag — mitigated by hard paid-tier gating |
| 24 | Goals tracking (simple, not enterprise OKRs) | Medium-High | Overrides guardrail's advisory flag — mitigated by flat scope, no OKR jargon |
| 25 | Timeline / Gantt view | High | Overrides guardrail's advisory flag — mitigated by no dependencies, reuses Calendar's data |

**Explicitly skipped for now:** Play Store / App Store presence — revisit using strategy report §11 once there are paying users.
