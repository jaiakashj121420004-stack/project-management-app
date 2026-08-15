# Feature Gap Analysis — Aurora vs. Notion / ClickUp / Monday.com / Asana / Trello (Aug 2026)

> **Scope note:** this is Task 1 of `IMPROVEMENT-PLAN-2026-08.md`. It does **not** repeat anything already scoped elsewhere in that plan — table blocks (Task 10), MCP/Claude connector (Task 12), funnel analytics (Task 3), per-project/custom color re-theming (Tasks 5–7), calendar polish (Task 8), to-do drag-and-drop (Task 9), or "Add to Home Screen" (Task 4). Those are real, already planned; this document is everything *outside* that list. Companion doc: [SIMPLICITY-GUARDRAIL.md](./SIMPLICITY-GUARDRAIL.md) — run every item below through it before building.
>
> **Update (2026-08-15):** all 7 prioritized gaps below have since been scoped into `IMPROVEMENT-PLAN-2026-08.md` as Tasks 16–22 (see each item's "Scoped as" line). Additionally, three items from the "bloat risk" section below — rule-builder automations, goals/OKRs, and a Gantt/timeline view — were reviewed and explicitly greenlit by product decision (Tasks 23–25), overriding this document's original advisory recommendation. Each carries a stated mitigation instead of an outright rejection; see the note under each item.

**Method:** web research (Aug 2026) on current feature sets, pricing tiers, and user complaints for Notion, ClickUp, Monday.com, Asana, and Trello, cross-referenced against Aurora's actual current feature set (`plan.md` §5, and a direct read of `src/features/*` — boards, todos w/ recurrence, calendar w/ ICS, notes, canvas, collaboration/comments/mentions/reactions/notifications, command palette, sharing, library). Sources are linked inline.

---

## What's already true about Aurora that competitor research keeps surfacing as rare

Worth stating plainly, because it changes how the gaps below should be read: Aurora already ships several things reviewers call out as differentiators when *other* tools lack them — real-time collaborative canvas (most tools bolt this on or omit it entirely), a unified calendar merging boards + to-dos + milestones with an ICS feed, @mentions/reactions/activity feed/review-approval on top of comments, a command palette, and flat non-per-seat pricing (a genuine rarity — Asana/Monday/ClickUp are all per-seat). The gaps below are additions to a genuinely competitive base, not a rescue plan.

---

## Prioritized gaps

### 1. Time tracking (simple start/stop timer, per card or to-do)
**Scoped as:** Task 16 in `IMPROVEMENT-PLAN-2026-08.md`.
**Why a real small team needs this:** the single most consistently cited freelancer requirement in this research — freelancers bill by the hour and currently juggle a separate timer app. ClickUp bundles this even on its cheapest paid tier specifically because it's table-stakes for solo/small-team users; Asana and Monday gate it behind mid-tier plans, which is a stated pain point for exactly Aurora's target segment. ([TaskRhino: Asana vs monday vs ClickUp](https://www.taskrhino.ca/blog/asana-vs-monday-vs-clickup/), [Digital Project Manager: freelance PM tools](https://thedigitalprojectmanager.com/tools/best-freelance-project-management-software/))
**Complexity:** Medium. One `time_entries` table (card_id or todo_id, user_id, started_at, ended_at), a start/stop button on the card/todo detail view, a running total shown inline. **Guardrail:** stop at "start, stop, see total hours per card/project." Do not build invoicing, billable-rate calculations, or timesheet reports in v1 — that's a second, separate decision (see #6 below for the closely-related but explicitly-deferred idea).

### 2. Client-facing read-only share link (no account required)
**Scoped as:** Task 17 in `IMPROVEMENT-PLAN-2026-08.md`.
**Why a real small team needs this:** freelancers need to show a client progress without giving them a seat or requiring signup — Trello and Asana both support public/guest read-only board views for exactly this. Aurora's existing `sharing` feature (`src/features/sharing/`) only invites *registered users* by email as editor/viewer collaborators on a note or canvas — there is no unauthenticated, view-only link for a project/board today. This is a genuine gap, not an overlap with what's already built.
**Complexity:** Medium-high (new territory: an unauthenticated read path through RLS, a revocable token similar in spirit to the existing calendar ICS feed token). Worth scoping carefully — see Task 12's MCP token pattern as a precedent for "revocable, scoped, non-password token" once that session exists.

### 3. Simple file attachments on cards
**Scoped as:** Task 18 in `IMPROVEMENT-PLAN-2026-08.md`.
**Why a real small team needs this:** attaching a contract, mockup, or reference PDF directly to a task is baseline expectation across every competitor studied, and freelancer research lists "file sharing" as a top-10 need. Aurora currently has no attachment path on cards — only checklist items and labels (`cardExtras.api.ts`); notes/canvas already have a private media bucket (`note-media`) whose pattern (private Storage bucket + signed URLs + RLS) is the direct template to reuse.
**Complexity:** Medium — mirrors an already-shipped pattern rather than inventing one.

### 4. Project/board starter templates
**Scoped as:** Task 19 in `IMPROVEMENT-PLAN-2026-08.md` — **expanded per product decision (2026-08-15)** beyond this document's original recommendation into a full "save as template" custom template builder, not just curated system templates. The mitigation keeping this from becoming a second onboarding flow: authoring is "save your current project as a template," not a standalone builder form — see Task 19 for the full design.
**Why a real small team needs this:** the blank-page problem is real friction for a first-time, non-technical user — exactly who Aurora's simplicity mandate targets. Monday.com ships 200+ templates specifically to solve this; Notion's own research (below) names "building vs. using" — users burning time architecting instead of working — as a core failure mode. A *small, curated* set of starter templates (e.g. "Freelance client project," "Content calendar," "Simple sprint board") is the anti-Notion answer: zero-config by default, opinionated, not a blank canvas. Aurora's to-do feature already has this exact pattern (`src/features/todos/starterTemplates.ts`) — this extends it to project/board creation.
**Complexity:** Low-medium for the curated system templates; medium-high once the custom template builder (Task 19 Part B) is included.

### 5. Full-text search across card and note content
**Scoped as:** Task 20 in `IMPROVEMENT-PLAN-2026-08.md`.
**Why a real small team needs this:** the command palette (`⌘K`) today indexes project/note/canvas/folder *names* for navigation, not the *content* inside cards or notes — so "where did I write that thing about the Q3 deadline" isn't answerable without opening every board manually. This is a baseline expectation once a workspace has more than a handful of items, and it's a single familiar affordance (a search box), so it doesn't add overwhelm the way a new nav surface would.
**Complexity:** Medium (Postgres full-text search or trigram index across `cards.title`/`description` and `notes.content`, surfaced as an extra result section in the existing command palette — not a new UI).

### 6. One-time import from Trello/Asana/CSV
**Scoped as:** Task 21 in `IMPROVEMENT-PLAN-2026-08.md`.
**Why a real small team needs this:** the strategy report already identified high "tool churn" in this category as Aurora's biggest acquisition opportunity — people actively browse alternatives. The single biggest friction point for someone switching tools is re-creating their existing boards by hand. A one-time CSV or Trello-JSON-export importer directly lowers the cost of trying Aurora.
**Complexity:** Medium. Parse Trello's JSON export / a generic CSV shape into projects/columns/cards; one-way, one-time, no ongoing sync.

### 7. Recurring Kanban cards (not just to-dos)
**Scoped as:** Task 22 in `IMPROVEMENT-PLAN-2026-08.md`.
**Why a real small team needs this:** the to-do planner already has real recurrence (`src/features/todos/recurrence.ts`); board cards don't. Small teams have recurring board-level work too — a monthly retainer task, a weekly content card, a subscription renewal — that currently has to be manually re-created each cycle.
**Complexity:** Low-medium — this is substantially "wire the existing recurrence engine to a second table," not new architecture.

---

## Explicitly flagged as bloat risk (popular, but deliberately not recommended now — or ever)

These showed up repeatedly in competitor feature lists and are genuinely popular, which is exactly why they need to be named and rejected on purpose rather than silently added later "because ClickUp has it."

- **Rule-builder automations ("if X then Y").** ClickUp and Monday both offer full automation builders, and both are also cited by name as the source of "feature overload" and decision paralysis in first-time-user reviews ([Tech Stack Daily: ClickUp Pros and Cons 2026](https://techstackdaily.com/review/clickup-pros-and-cons-2026/)). If Aurora wants any of this, it should be 2-3 fixed, zero-configuration behaviors (e.g. "move to Done when the checklist is 100% complete") — never a rule builder with triggers/conditions/actions the user has to design. **Update 2026-08-15 — overridden by product decision:** scoped as Task 23 (`IMPROVEMENT-PLAN-2026-08.md`), built with a small fixed trigger/action enum and gated entirely to Pro/Team plans so free-tier first-time users never see it. Mitigation is the hard paid-tier gate, not a smaller feature.
- **Custom per-column field types (select, person, number, formula).** Already explicitly ruled out in the Table Block task (Task 10) for tables specifically — the same reasoning applies everywhere else. This is "the real mini-database" Notion's own reviewers say creates a "building vs. using" trap. Still rejected — no override.
- **Task dependencies / blocking relationships.** Common in Asana/Monday for larger cross-team workflows, but adds a whole layer of "why can't I move this card" confusion for a solo/small-team user that Aurora's target audience mostly doesn't need. Skip. Still rejected — no override, including as part of Task 25's Gantt view.
- **Nested subtasks as a separate primitive from checklists.** Checklist items already solve "break this into smaller steps" for the vast majority of small-team use cases; a second, structurally different nesting concept (sub-cards with their own status/assignee/due date) is exactly the kind of "two ways to do the same thing" that confuses first-time users. Don't add it. Still rejected — no override.
- **Goals/OKR tracking modules.** Present in ClickUp/Asana, but this is a mid-market/enterprise reporting feature with little pull for freelancers or small teams — no research signal here that Aurora's actual users are asking for it. **Update 2026-08-15 — overridden by product decision:** scoped as Task 24, deliberately built as "goals with a progress bar" rather than enterprise OKRs (no Objectives/Key-Results split, no jargon in the UI). Mitigation is flattened scope, not gating.
- **Gantt/timeline view as a first-class board mode.** Real demand exists once a team scales past Aurora's core audience (Trello's own reviewers cite its *absence* as a growth-stage limitation, not a day-one one). Worth a "someday, if users ask" note, not a roadmap slot — a fourth major view mode is real ongoing surface area to maintain and explain. **Update 2026-08-15 — overridden by product decision:** scoped as Task 25, reached via a view toggle inside the existing Calendar/Board toolbar (not a new nav item) and explicitly without task dependencies. Mitigation is placement + scope, not gating.
- **AI features gated as a separate paid add-on.** ClickUp's AI Brain is praised functionally but its $5/mo *additional* add-on pricing is called out as friction. If Aurora ever adds AI features, keep them inside the existing flat-price tier rather than introducing a third pricing dimension. Still not scoped anywhere — no override.

---

## Sources

- [ClickUp Pros and Cons 2026 — Tech Stack Daily](https://techstackdaily.com/review/clickup-pros-and-cons-2026/)
- [Asana vs monday vs ClickUp: In-Depth Comparison 2026 — TaskRhino](https://www.taskrhino.ca/blog/asana-vs-monday-vs-clickup/)
- [Notion review (2026) — eesel AI](https://www.eesel.ai/blog/notion-review)
- [Top 5 Complaints About Trello — Herdr Blog](https://blog.herdr.io/work-management/title-top-5-complaints-about-trello-in-2025-what-users-are-saying/)
- [10 Best Freelance Project Management Software For 2026 — The Digital Project Manager](https://thedigitalprojectmanager.com/tools/best-freelance-project-management-software/)
- Internal: `reports/Aurora_Full_Strategy_Report_2026-08-13.html` §4 (tool-churn / overwhelm findings, already cited in `CLAUDE.md`)
