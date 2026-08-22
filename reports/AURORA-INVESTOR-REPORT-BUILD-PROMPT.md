# Build prompt: Aurora Investor Strategy Report (HTML)

> **How to use this file:** paste everything below into a **new** Claude Code / Claude Cowork session that has this repo (`project-management-app`) connected. It is self-contained — the session does not need this conversation's history, only this repo. Effort should be Sonnet Medium-High thinking or a smarter model if available; this is a research-and-synthesis task, not a mechanical one.

---

## 0. Context for the session that picks this up

This is **Task 15** from `IMPROVEMENT-PLAN-2026-08.md` ("Marketing plan — separate future session, after everything above"), now being run for real. Task 15's own note says: *"the existing `reports/Aurora_Full_Strategy_Report_2026-08-13.html` already has a full marketing strategy section (§10)... that session shouldn't start from zero, it should treat that section as the draft and turn it into the dedicated, more detailed pre-launch/post-launch marketing plan HTML you asked for, refreshing anything that's changed in the meantime."*

Since 13 August 2026, a large amount has shipped (goals, automations, time tracking, file attachments, full-text search, project templates incl. a custom template builder, one-time Trello/CSV import, recurring board cards, a client-facing read-only share link, an MCP server so Pro+ users can connect Claude Desktop/Code to their account, a Calendar Timeline/Gantt view and a Day view, table blocks + math formulas + sub/superscript in the editor, note export to Markdown/Word/PDF, a funnel-analytics layer that did not exist in August, a written bus-factor runbook, a pentest-readiness brief, and a formalized "simplicity guardrail" review process). **Do not simply re-publish the 13 August report.** Treat it as a first draft whose facts must be re-verified and whose gaps (no analytics, no bus-factor doc, pentest only scoped) are now closed and need updating.

---

## 1. What you're building, and for whom

A single, self-contained HTML document: **a strategy/investor report for Aurora (by Nvexis)** — a project-management PWA. The reader is a **financially and technically literate investor** who will notice hype, rounding tricks, or unsupported claims immediately and will discount the whole document if they catch even one. Optimize for credibility, not for looking impressive.

**Non-negotiable ground rules — read twice before writing a single number:**

1. **No invented numbers.** Every figure in the document must be one of: (a) read directly from this repo's code/config/docs (cite the file), (b) a live 2026 web-search result you actually ran this session (cite the source), or (c) an explicitly-labeled planning estimate/assumption, framed as a range with its methodology shown, never as a bare confident number. If you don't know something, say "not yet measured" or "unknown until live" rather than filling the gap with a plausible-sounding figure.
2. **Do not restate the 13 August report's market/pricing/CAC figures as current without re-checking them.** Run fresh web searches for: PM-software market size/CAGR, competitor pricing (Trello/Asana/ClickUp/Monday/Notion/Todoist — and now also check whether any of them shipped a "calm mode" or bundled a feature that blunts Aurora's positioning), freemium conversion benchmarks, CAC benchmarks, current Supabase/Cloudflare Pages/Resend/Dodo Payments pricing tiers. If a figure hasn't materially changed, say so and keep it; if it has, use the new figure and note the change.
3. **Per explicit instruction from the founder: do NOT list the pending penetration test or the not-yet-run marketing motion as a Weakness or a Threat in the SWOT.** Both are planned, budgeted, scheduled pre-launch actions, not gaps in the product — they belong in the Pre-Launch Checklist (§11 below), framed as scheduled/in-progress, not as risk factors. This is a deliberate framing choice the founder made explicitly; don't second-guess it in the copy.
4. **Every feature claim must be traceable to real shipped code**, not the roadmap. Read `memory.md`'s Feature log and `src/features/*` directly — do not describe a feature as done if `memory.md`'s Open Items section marks it uncommitted, unwired, or unverified (e.g., as of 22 Aug 2026, Task 31's drag-and-drop block reordering is built but **not yet wired into `NoteBlockEditor.tsx`** — describe it accurately: built, not yet live — and several 22 Aug features are uncommitted pending a Windows build pass). Get the *current* state by reading `memory.md` fresh in this session, not by trusting this prompt's summary below, which will itself go stale.
5. **Keep the tone the founder asked for: authentic, not a pitch.** No superlatives without a fact backing them up ("fast" → give the actual build time or bundle size; "secure" → name the specific control). Where something is a real, unresolved weakness, say so plainly (e.g., solo-maintainer bus factor is real even with a runbook written — a runbook mitigates the risk, it doesn't remove it).

---

## 2. Required research pass (do this before writing any prose)

### 2.1 Read these files in the repo, in full, first
- `CLAUDE.md`, `memory.md` (read the *whole* current Status section and Feature log — it is long; don't skim), `plan.md`, `NVEXIS-UPGRADE-PLAN.md`, `REMEDIATION-PLAN.md`, `PHASE-7-VERIFICATION.md`, `DESIGN-GUIDELINES.md`, `IMPROVEMENT-PLAN-2026-08.md` (especially the Task 15 note and the current Open Items / Tasks 26–38 state)
- `reports/Aurora_Full_Strategy_Report_2026-08-13.html` — the prior version of this exact report; your draft
- `reports/FEATURE-GAP-ANALYSIS.md`, `reports/SIMPLICITY-GUARDRAIL.md`, `reports/SIMPLICITY-AUDIT-2026-08.md`, `reports/ANALYTICS.md`, `reports/BUS-FACTOR-RUNBOOK.md`, `reports/PENTEST-READINESS-2026.md`
- `reports/Aurora_Publishing_Marketing_Revenue_Report.pdf` and `reports/Aurora_Penetration_Test_Options_Report.pdf` (earlier internal reports — read for numbers/decisions that still hold)
- `package.json` (dependency list = ground truth for the tech-stack section — note the current React/Vite/TypeScript/Tiptap/Yjs/Konva/dnd-kit/Supabase-js versions; confirm the old `@fontsource-variable/inter`/`space-grotesk` dead dependencies are in fact gone, since the 13 Aug report flagged them and they are absent from the version of `package.json` read on 22 Aug — verify this is still true and, if so, mark that item resolved rather than repeating it as an open risk)
- `supabase/migrations/` (list every file — this is your evidence for "how much has shipped" and roughly when; count them, note the date range)
- `supabase/functions/` (list every Edge Function — this is your evidence for the serverless surface: billing, calendar feed, MCP server, analytics, reminders, automations, share links)
- `legal/` (note that `Aurora-Terms-of-Service.docx` and `Aurora-Privacy-Policy.docx` already exist as drafts — check whether `memory.md`/`CLAUDE.md` says they've had a lawyer review; if not, that's a real pre-launch checklist item)
- `marketing-site/index.html` (there is already a public-facing marketing landing page — check what it currently says/promises so the investor report doesn't contradict it)
- `src/features/*` directory listing (use it to build the exhaustive feature list in §5 below — don't rely on memory of what's "supposed" to be there; list what actually exists as a folder/file)

### 2.2 Live web research to run this session (cite every source used, with a real link)
- Current 2026 pricing pages for: **Supabase** (Free/Pro/Team tier limits and $ costs — rows, storage, bandwidth, Edge Function invocations, MAUs), **Cloudflare Pages/Workers** (free tier limits, paid tier if it'd ever be needed), **Resend** (free tier email volume, paid tiers), **Dodo Payments** (merchant-of-record fee structure — confirm the ~4-13% blended figure the 13 Aug report used is still accurate).
- Current entry-tier pricing for Trello, Asana, ClickUp, Monday.com, Notion, Todoist — confirm or update the 13 Aug comparison table.
- Current PM-software market size and CAGR estimates (at least 3 independent research-firm sources, report the range honestly rather than picking the most flattering number).
- Freemium conversion-rate benchmarks and blended CAC benchmarks for self-serve SaaS (2026 sources).
- Any 2026 developments in Google Play Billing policy or Apple App Store Guideline 4.2 PWA/TWA treatment, since the 13 Aug report flagged this as a "live policy area."

### 2.3 Cost-model research specifically (needed for §9 — do not skip)
Build an actual, source-cited cost table for **100, 1,000, and 10,000 registered users**, each broken into **mild / normal / heavy** usage tiers. To do this credibly:
- Define what "mild/normal/heavy" means concretely for Aurora (e.g., mild = signed up, opens the app a few times a month, 1 small board; normal = daily active, several boards, regular canvas/notes use; heavy = a Team-plan account with many collaborators, heavy canvas media uploads, automations running, MCP usage). State the definition in the report — don't leave it implicit.
- Estimate realistic per-user resource consumption (DB rows, Storage MB, Realtime connections, Edge Function invocations, email sends) for each tier, grounded in what the product actually does (read `src/lib/proFeatures.ts`, the Storage/media-cap logic, and the automations/reminders Edge Functions to inform this, rather than guessing blind).
- Map total resource consumption at each of the three user-count milestones against the real current Supabase/Cloudflare/Resend/Dodo pricing tiers from §2.2, and show which tier of each vendor is needed at each milestone and why.
- Show your work as a table, not just a final number — an investor will want to see the assumption chain, not just trust a total.

---

## 3. Document structure (required sections, in this order)

Use this as the table of contents (and the sidebar nav — see §12). Section numbers are for your own drafting reference; use descriptive `id`s for anchors, matching the pattern in the 13 Aug report.

1. **Cover** — title, one-line description of what the report contains, prepared date, confidentiality notice, "Aurora is a product of Nvexis" attribution line (per the locked brand hierarchy in `CLAUDE.md`).
2. **Executive Summary** — one page: what Aurora is, where it stands (pre-revenue, feature-complete for launch, what's actually still open), the three questions this report answers (is the product good, who's the competition and is there a real edge, what will it realistically earn and how will it be marketed).
3. **Present State & Roadmap** — an honest, current snapshot (not the 13 Aug one) of what's built vs. what's still open per `memory.md`'s Open Items, plus the near-term roadmap in priority order.
4. **Product Overview: Every Feature, In Detail** — see §5 below. This must be exhaustive, not a highlight reel — the founder explicitly asked for even the smallest features explained.
5. **Target User Personas** — see §6 below.
6. **Market Research** — market size, CAGR, why the category is growing, where Aurora fits (update the 13 Aug figures per §2.2).
7. **Buyer Psychology** — why people pick and pay for a tool like this (can largely carry forward the 13 Aug §4 content if it still checks out, updated for anything new — e.g., the product now has a real referral-adjacent mechanic, real templates lowering the blank-page problem, etc.)
8. **Competitive Analysis** — updated pricing-comparison table and competitor-by-competitor breakdown; update Aurora's positioning wedge to reflect the larger feature set now (time tracking, share links, templates, automations, goals, Gantt) without losing the "still calm, not ClickUp" framing — that's the whole point of the Simplicity Guardrail process, which is itself worth mentioning as a differentiator (a documented, followed anti-bloat discipline is rare and credible to a sophisticated investor).
9. **SWOT Analysis** — grounded in the actual current codebase and posture. Per rule 3 in §1, do not put the pentest or the marketing launch in Weaknesses/Threats. Do update Strengths (analytics now shipped, bus-factor runbook now written, broader feature set, formalized simplicity-review process) and Weaknesses (what's genuinely still true — e.g. still solo/small-team bus factor even with a runbook, several 22 Aug features still uncommitted/unverified, no admin UI for analytics, some sync-related device-bridge friction documented in project memory that isn't a product risk but is worth knowing internally, is not investor-facing).
10. **Technology & Security Assessment** — full stack (verified from `package.json`/`supabase/`), the security model (RLS everywhere, SECURITY DEFINER pinning, the 7-phase remediation, the pgTAP regression suite and its current assertion count, the MCP auth design, the analytics endpoint's validation model), and the pentest-readiness brief's content — presented as "here is our security posture and here is the scoped, budgeted, pre-launch pentest plan," not as an open risk.
11. **Pre-Launch Checklist** — see §11 below.
12. **Cost Model** — see §9 below (100/1,000/10,000 users × mild/normal/heavy).
13. **Revenue & Profit Projections** — Worst / Normal / Best case, both global-USD and India-PPP scenarios, updated methodology (see §10 below).
14. **90-Day Marketing Plan** — see §8 below. This is the section the founder is most focused on — give it real depth.
15. **App Store & Play Store Feasibility** — carry forward and re-verify the 13 Aug §11 conclusion.
16. **Sources & Methodology** — every source used, internal and external, plus the standard disclaimer that this is planning material, not financial/legal/investment advice.

---

## 4. Design & format requirements

- **Single self-contained HTML file.** Inline all CSS/JS. Google Fonts `<link>` is fine (matches the existing report and the app itself).
- **Follow the Aurora/Nvexis "Almanac" brand system exactly** — source of truth is `DESIGN-GUIDELINES.md` and the live tokens in `src/styles/index.css`/`tailwind.config.ts`. Do not invent new colors. Known tokens (verify against `src/styles/index.css` before use, since these may have shifted):
  - Oxblood accent: `#7A2A26` (Day) / `#C24A40` (Night)
  - Parchment (Day bg): `#ECE4D6`; Ink (Night bg): `#181210` (the 13 Aug report used `#221A14` for ink — check the live token and use whichever is actually current in `src/styles/index.css`)
  - Fonts: **Fraunces** (display/headings), **Spectral** (body), **IBM Plex Mono** (figures/eyebrows/labels). Never Inter, never Space Grotesk.
  - Aesthetic: glassmorphism warmed onto paper (not white frost), subtle paper-grain texture, oxblood as the single chroma accent.
- **Full light AND dark mode, both first-class**, with a real toggle (not just `prefers-color-scheme` detection) — persist the choice (e.g. `localStorage`), default to system preference on first load. Cross-fade the switch, matching the app's own theme-toggle behavior described in `plan.md`/`memory.md`.
- **A toggleable sidebar table of contents.** This is a step up from the 13 Aug report's static top `nav.toc` block — build a real collapsible left-rail sidebar (fixed position on desktop, off-canvas/hamburger-triggered on mobile) listing every section from §3 above, highlighting the current section on scroll (an intersection-observer based active-state is enough; don't over-engineer this). Include an explicit open/close toggle button, not just responsive auto-hide.
- **Responsive for laptop, tablet, and phone.** Test your own layout logic mentally against at least three breakpoints (e.g. ~375px, ~768px, ~1440px) — tables must scroll horizontally inside their own container rather than breaking the page width; the SWOT grid, comparison grids, and KPI tiles should collapse to a single column on narrow viewports (the 13 Aug report already does this at 760px — verify it still works with the added sidebar and don't regress it).
- **Print-friendly** — keep the `@media print` handling from the 13 Aug report (hide the sidebar/nav, avoid mid-section page breaks) since an investor may print or PDF-export this.
- **No external network calls other than Google Fonts** — this must open correctly from a local file or an offline-ish context; no CDN JS dependencies.

---

## 5. Product Overview section — how to make it genuinely exhaustive

The founder explicitly wants **every feature, including the smallest ones, explained**. Don't write a bullet-point feature list; write real subsections a non-technical investor can actually follow, organized by area. Build this by reading `src/features/*` directly (folder-by-folder) plus `memory.md`'s Feature log — do not rely on the placeholder list below, which is a starting skeleton only and is already known to be incomplete/possibly stale by the time you read this:

- **Kanban boards** — columns, drag-and-drop, checklists, labels, priority tiers, due dates (+ time on Pro), assignees, recurring cards, file attachments, per-card time tracking (start/stop/total, multi-user aware), comments with @mentions/reactions, a review/approval workflow, an activity feed, card-level reminders (Pro custom offsets/channels).
- **To-Do planner** — personal daily/weekly planning, custom recurrence rules (daily/weekly/monthly/interval), priority tiers, bulk actions, swipe gestures, starter templates.
- **Calendar** — Month/Week/Day/Timeline-Gantt views, unifying cards + to-dos + project milestones, quick-create, ICS subscribe feed for Google/Apple/Outlook, a project color-key legend.
- **Notes** — a Notion-style block/rich-text editor (Tiptap): headings, lists (bullet/ordered/task), tables, images (upload + clipboard paste), embeds, math formulas (KaTeX, inline & block), subscript/superscript, an auto-generated clickable table of contents per note, folders, templates (curated + custom "save as template"), full-text search, export to Markdown/Word(.docx)/PDF (Pro), drag-and-drop block reordering (note current wiring status accurately per memory.md).
- **Canvas** — an infinite real-time collaborative whiteboard (Konva + Yjs): freehand drawing with pressure-sensitive strokes, text boxes, images/media, tables, pages/frames, z-ordering, multi-select, a layers panel, undo/redo.
- **Collaboration** — roles (owner/editor/viewer), invitations, live presence, real-time sync, a client-facing read-only share link (no account required) for boards, standalone note/personal-canvas sharing with its own role model.
- **Goals** — lightweight progress-bar goals (deliberately not enterprise OKRs — a documented product decision, worth mentioning as evidence of the Simplicity Guardrail in action).
- **Automations** — a small, fixed trigger/action rule set (Pro/Team gated, deliberately not a general-purpose rule builder — again, cite the Simplicity Guardrail decision).
- **Import** — one-time Trello/CSV import.
- **Search** — full-text search across card and note content via the command palette.
- **Command palette** — quick navigation across projects/notes/canvases/folders.
- **MCP server ("Connect Claude")** — lets a Pro+ user connect Claude Desktop/Code directly to their Aurora account via a personal access token, read/write boards/to-dos/notes through the same RLS-enforced API surface as the app itself. Explain this plainly — it's a genuinely unusual feature for a PM tool at this stage and worth real explanation, not a throwaway line.
- **Personalization** — Day/Night theme, font pairing, custom color presets (curated grid + an advanced raw picker), synced to the account (not just device-local).
- **PWA / installability** — installable on mobile and desktop from any browser, offline caching, install-prompt handling per platform.
- **Notifications & reminders** — due-date reminders (email via Resend + browser notifications), Pro custom timed reminders with configurable lead time/channel.
- **Billing** — three priced tiers (Free/Pro/Team) + an unpriced Enterprise tier, Dodo Payments checkout, in-place plan switching, localized India pricing, webhook-verified entitlement (server is always the source of truth, never the client).
- **Analytics (internal, not user-facing)** — the funnel-tracking layer itself is worth describing in the tech/security section, not here.

For every item, state briefly *why it matters to the target user*, not just that it exists — this is what makes the section read as genuine product understanding rather than a changelog dump.

---

## 6. Target user personas — build these from the actual feature/pricing shape, not generically

Write 2–3 concrete personas grounded in what the product actually optimizes for (flat per-board pricing, India/PPP pricing, the freelancer-facing features added in the August improvement pass — time tracking, client share links, file attachments, templates). Suggested starting points to develop with real specificity (name, context, what tool(s) they're switching from, what in Aurora specifically solves their problem, what would make them upgrade to Pro):
- A solo freelancer or consultant currently juggling a board tool + a docs tool + a separate time-tracking app, who needs to show a client progress without giving them a login.
- A small creative/dev team (3–8 people) currently paying per-seat for Asana/ClickUp/Monday who would save real money on Aurora's flat per-board pricing and is tired of feature overload.
- A price-sensitive student or early-career/freelance user in a PPP market (India specifically, since pricing is already built for it) who wants an all-in-one tool but can't justify $10+/seat/month tools.

Ground each persona's "why Aurora" in a real, specific feature (not "it's great for teams") — e.g., persona 1 should reference the actual read-only share link feature; persona 3 should reference the actual ₹-denominated Dodo pricing.

---

## 7. SWOT — see rules in §1 and §3.9. Additional guidance

Update, don't copy, the 13 Aug SWOT. Concretely:
- **Move "no analytics" out of Weaknesses** — it shipped 15 Aug 2026 (`reports/ANALYTICS.md`). Consider adding "funnel instrumentation now live, still no admin dashboard to view it (query via SQL only)" as a smaller, more honest weakness instead of removing analytics from the conversation entirely.
- **Move "no bus-factor runbook" out of Weaknesses** — it's written (`reports/BUS-FACTOR-RUNBOOK.md`). The underlying solo-maintainer risk itself is still real and still belongs in Weaknesses, just reframed as "mitigated, not eliminated."
- **Do not add the pentest or the marketing launch to Weaknesses or Threats** — per explicit founder instruction (§1 rule 3).
- **Add to Strengths:** the formalized Simplicity Guardrail review process (a rare, genuinely-followed anti-bloat discipline — cite `reports/SIMPLICITY-GUARDRAIL.md` and at least one real example of a feature being deliberately scoped down because of it, e.g. Automations being a fixed rule set, Goals being progress-bar-only).
- **Check for anything genuinely new to add to Threats** from your fresh competitor research in §2.2 (e.g., did any competitor add a cheaper tier, a "focus mode," or similar since August).

---

## 8. 90-Day Marketing Plan — the section to build with the most care

The founder's exact requirement: **free/organic-first, paid only once customers are actually paying** (not calendar-gated — gate the paid-spend phase on a real revenue signal, e.g. "once the first N paying subscribers exist" or "once Dodo confirms live revenue," not just "day 60"). Cover Instagram, LinkedIn, Facebook, Twitter/X, and any other channel your research shows is actually the best fit (Reddit and Product Hunt were identified as high-value in the 13 Aug report for this specific product category — re-verify that's still the right call, and feel free to recommend against a channel if the research doesn't support it for this product).

Build this as a real, executable plan, not a restatement of the 13 Aug §10 bullet list:

- **Phase 1 (free/organic, days 1–~60 or until launch is stable — whichever the founder actually controls):** a channel-by-channel content calendar concept (not every single day's post, but a real cadence — e.g. "3x/week build-in-public posts on X, 1x/week LinkedIn post reframed for a professional audience, a Product Hunt launch timed for week X, Reddit participation in named specific subreddits with a stated posting cadence and tone guardrail against looking like spam"). Instagram/Facebook should get an honest assessment of fit — research whether these are actually good channels for a B2B/prosumer SaaS tool before recommending heavy investment there versus X/LinkedIn/Reddit/Product Hunt, and say so if the research doesn't support it.
- **Phase 2 (paid, gated on real paying customers existing):** which channel to test first and why (re-verify current CPC/CPM benchmarks per §2.2), a small initial budget band, and an explicit measurement plan referencing the funnel-analytics events that now actually exist (`reports/ANALYTICS.md` — `signup_started`, `checkout_started`, `checkout_completed`, `upgrade_prompt_shown`, etc.) since this closes the exact "marketing blind" gap the 13 Aug report flagged as the biggest risk. Say plainly that this gap is now closed, which is itself a meaningful update from August.
- **Message-testing angles** — carry forward and refresh the three from 13 Aug §10 (price-per-team, calm/anti-overwhelm, design/craft) and add any new angle the expanded feature set supports (e.g., the MCP/Claude-connector feature might be a genuine hook for a specific tech-forward audience segment worth a fourth angle — your call, but justify it if you add it).
- **Referral mechanic** — the founder's product already has invitations; note whether a "both get a month of Pro" referral incentive is built or would need building, and treat it as a near-zero-cost channel per standard CAC-benchmark research.

---

## 9. Cost Model — 100 / 1,000 / 10,000 users × mild / normal / heavy

See §2.3 for the research method. Present as a clear table (or three tables, one per user-count milestone) showing: assumed usage per tier, which vendor plan is required at that milestone, and the resulting monthly/annual cost. Show the math, not just the answer. Explicitly note where a milestone would force an upgrade from a free tier to a paid one (e.g., "at 10,000 users, Supabase's free-tier row/bandwidth caps are exceeded and the Pro plan at $X/mo becomes necessary because Y") — this is exactly the kind of concrete, checkable claim a sophisticated investor will trust.

---

## 10. Revenue & Profit Projections — Worst / Normal / Best

The founder asked specifically for **worst case, normal case, and best case** (not "conservative/base/optimistic" relabeled without thought — use whichever framing reads clearest, but make sure a true worst case is genuinely pessimistic, e.g. near-zero conversion, marketing not working at all, not just a slightly-lower version of the base case). Build on the 13 Aug §12 methodology (unit economics net of Dodo's fee, freemium conversion-rate benchmarks, a Pro/Team mix) but:
- Re-verify Dodo's fee structure and every listed price is still accurate against the live pricing implementation (check `src/lib/plans.ts` or wherever pricing now lives) and Dodo's current published fee schedule.
- Reflect the larger feature set's likely effect on conversion (more Pro-gated hooks now exist — time tracking, custom reminders, canvas, automations, templates, exports — which is a real, citable reason conversion assumptions might be modestly higher than the 13 Aug estimate; don't inflate this without saying explicitly that it's a judgment call, not a measured fact, since there is still zero live revenue data).
- Keep both a global-USD scenario and an India-PPP scenario, as the 13 Aug report did.
- Keep the "honest expectations" framing at the end — most indie SaaS never crosses $1k MRR, and it's a distribution problem more than a cost or product one. This is the kind of self-aware, non-hyped framing the founder explicitly asked for — keep it, don't soften it.

---

## 11. Pre-Launch Checklist

Build a real, current checklist by cross-referencing `memory.md`'s Open Items, `CLAUDE.md`'s stated "remaining human-only go-live gates," `BUS-FACTOR-RUNBOOK.md`, and `PENTEST-READINESS-2026.md`. As of the version of these files read on 22 Aug 2026, likely items include (verify each is still accurate, and add anything new memory.md now shows):

- Dodo Payments: KYC approval finalized, live API keys/product IDs swapped in, `DODO_PAYMENTS_ENVIRONMENT` flipped to live.
- Resend: a verified sending domain, then set a real `REMINDER_FROM_EMAIL` (currently falls back to `onboarding@resend.dev`).
- Commission the independent penetration test (already scoped: $4,000–$8,000, gray-box, per `reports/PENTEST-READINESS-2026.md` and the companion options PDF) — list as an in-progress/scheduled item, not a weakness (per §1 rule 3).
- Legal: `Aurora-Terms-of-Service.docx` / `Aurora-Privacy-Policy.docx` exist as drafts — confirm whether they've had a qualified legal review before go-live; if `memory.md`/`CLAUDE.md` doesn't confirm this happened, list it as open.
- GitHub account MFA (flagged in `BUS-FACTOR-RUNBOOK.md` as an outstanding hardening item — verify it's still outstanding).
- Optional: scrub the old rotated secrets out of git history (`git filter-repo`/BFG) — low urgency since the credentials were already rotated, per `BUS-FACTOR-RUNBOOK.md` §1b, but worth listing as a hygiene item.
- Complete the pending Windows verification pass (`npm install && npm run typecheck && npm run build`) for every feature `memory.md` currently marks uncommitted/unverified as of the date you read it (list them by name, don't just say "some features") — then commit and push.
- Finish wiring Task 31 (drag-and-drop note block reordering) end-to-end if it's still not fully wired by the time you read `memory.md`.
- Run the executable Lighthouse/mobile/regression re-score checklist referenced in `PHASE-7-VERIFICATION.md` if it hasn't been run since the newest features shipped.
- Anything else `memory.md`'s Open Items section flags that isn't covered above — read it fresh, don't rely on this list being complete.

Do **not** include the marketing launch itself as a checklist blocker for shipping the product — per the founder, marketing is a parallel workstream this same report covers in §8/14, not a go-live gate.

---

## 12. Sidebar/navigation implementation notes

- Build the sidebar as a fixed left rail (desktop) that becomes an off-canvas drawer behind a hamburger toggle (mobile/tablet). Include a visible toggle button in both states (collapse-to-icons or fully hide, your call, but it must be genuinely toggleable, not just responsive).
- Reuse the section list from §3 as the nav's link targets (`href="#exec"` etc., matching the anchor-id convention already used in the 13 Aug report).
- Add the light/dark toggle and the sidebar toggle to the same persistent header/rail area so both are always reachable while scrolling.

---

## 13. Wrap-up steps (do these after the HTML is done)

1. Save the finished file into `reports/` following the existing naming convention, e.g. `reports/Aurora_Investor_Report_<today's date>.html` (superseding, not deleting, the 13 Aug file — leave that one in place as history, the way this project's docs generally treat superseded material).
2. **This report contains real internal financial estimates, security posture detail, and infrastructure specifics — treat it as confidential.** Deliver it to the founder as a direct file download; do not auto-publish it to a public hosted link. If the founder later wants a shareable link for a specific investor, that's their call to make after reviewing the content, not a default.
3. Per this repo's `CLAUDE.md` golden workflow: after finishing, add a short dated entry to `memory.md`'s Feature log (e.g. "📝 Report (date): Investor Strategy Report v2 built — Task 15 of IMPROVEMENT-PLAN-2026-08.md, supersedes the 13 Aug report") and commit it along with the new report file, following the Conventional Commits style already used in this repo (`docs: add investor strategy report, closes Task 15`).
4. In your final chat reply, tell the founder plainly which numbers in the report are hard facts from the codebase, which are fresh 2026 web-research figures (with sources), and which are explicitly-labeled planning estimates — so they can sanity-check the highest-stakes ones themselves before showing it to anyone.
