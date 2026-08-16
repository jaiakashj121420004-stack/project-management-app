# Simplicity Audit — 2026-08-16

> First audit pass under the newly-formalized rule in `CLAUDE.md` (Golden workflow rule 7): every new feature proposal is checked against [SIMPLICITY-GUARDRAIL.md](./SIMPLICITY-GUARDRAIL.md) before being built. This document is the other half of that — an honest look backward at what's already shipped, read against the same checklist. It is advisory, per the guardrail's own framing: every item below is a suggested simplification, not a redesign mandate. Deciding what to act on is a separate, deliberate step.

**Scope:** the Sidebar's top-level nav (`navItems.ts`), and the primary UI of each destination it points to — Today, Boards (Projects → a project's Board/Notes/Canvas/Activity tabs), To-Do, Calendar, Library, Settings, plus the always-available Topbar/HelpPanel chrome. Read directly from source, not from running the app.

## What's already working well

Worth naming, since the checklist is easy to read as only a list of complaints:

- **Top-level nav is tight.** `navItems.ts` has 8 items, 5 of which are in the mobile bottom bar. That's well inside "a first-time user can scan the whole nav in five seconds" territory, and most of Aurora's actual feature surface (labels, checklists, reviews, comments, reminders, table blocks) lives *inside* a project rather than as its own nav destination — exactly what guardrail item 1 asks for.
- **Settings → Custom colors is the checklist working as intended.** The 8-tile `PersonalizationPresetGrid` leads, the raw hex/color-wheel picker is demoted to a collapsed "Advanced" disclosure, and picking a preset vs. editing Advanced are mutually exclusive so there's one source of truth. That's items 3 and 8 (curated default, zero-config, raw controls hidden behind a disclosure) done correctly — and per `memory.md`, this was itself a guardrail-driven rebuild of an earlier raw-picker version that produced ugly combinations.
- **To-Do starter templates** (`STARTER_TEMPLATES` in `TodosPage.tsx`) give the empty state a one-tap useful default instead of a blank list waiting to be configured — item 3 again.
- **Today** is a good answer to item 5 (second way to do something) risk avoided: it's explicitly a read-only aggregation view over Boards/Calendar/To-Do, not a fourth place to create or edit things.

## Findings

### 1. The card detail modal stacks ~10 sections with no grouping (guardrail items 2, 7)

`CardDetailModal.tsx`'s editable form renders, in one scrolling `max-h-[72vh]` panel: Title, Description, Due date (+ time on Pro), Reminders, Priority, Assignee, Labels, Checklist, then (via `CardCollaboration`) Review status, Reactions (Pro), Comment thread, and Activity feed (Pro) — eleven distinct sections, each its own component, one after another with only thin `border-t` dividers between some of them. Opening any card, even a brand-new one with nothing filled in, shows the full stack.

This is the single densest surface in the app and the one most first-time users will hit almost immediately (opening a card is one of the first things anyone does on a Kanban board). A 60-year-old first-time user opening a card to jot a due date has to visually parse past reminders, priority, assignee, labels, and a checklist before they even reach the comment thread — none of which they asked to see yet.

**Suggestion:** collapse the collaboration block (review/reactions/comments/activity) behind a single "Discussion" disclosure or a second tab, the way Settings already collapses "Advanced" — the core edit fields (title, description, due date) stay immediately visible and everything else is one tap away rather than a scroll away. This wouldn't remove any capability, just defers it until asked for.

### 2. The canvas toolbar has grown to ~24 buttons with a selection active — Task 10's table tools landed on an already-crowded surface (guardrail items 6/7, self-critique requested by the brief)

`CanvasToolbar.tsx`, with `canEdit` and a selection active, renders: select/draw/text/erase (4) → undo/redo (2) → add-text/add-page/add-frame/**add-table**/add-image/add-media (6) → page-type dropdown (1) → zoom out/reset/in (3) → z-order ×4/duplicate/lock/delete (7) → layers toggle (1). That's 24 individual controls plus one dropdown, before counting the mobile "Tools" collapse toggle. Every button does have a `title`/`aria-label`, so item 2's letter is satisfied (nothing is unlabeled), but the toolbar as a whole is the kind of "feature overload" surface the guardrail's intro specifically names as ClickUp's failure mode — a user has to scan a long, undifferentiated row of icons to find the one they want.

Being honest about Task 10 specifically: the table block added one more icon (`Table2`) plus, once a table is placed, its own trailing add/remove-row/column controls and per-column resize handles (`TableGrid.tsx`) — a second, adjacent maintenance surface layered onto a toolbar that was already dense with add-page and add-frame from the Nvexis notes/canvas expansion. Nothing about the table feature itself is over-built (it's a fixed grid editor, not a rule-builder), but its landing spot made an existing overload problem slightly worse rather than better.

**Suggestion:** group the "add" tools (text/page/frame/table/image/media) behind a single "Insert" menu button instead of six adjacent icons — this is the same pattern the mobile collapse already uses for the whole toolbar, just applied one level down. That would take the always-visible row from ~15 icons down to ~10 without removing any capability.

### 3. Board toolbar shows Pro-only review-status filter chips to every user, unconditionally (guardrail item 2)

`BoardToolbar.tsx` always renders three filter chips — "In review", "Needs changes", "Approved" — regardless of whether the project uses (or can use) the review workflow; `Board.tsx` passes `reviewFilters` straight through with no `isProBoard` gate (contrast with `CardCollaboration` in `CardDetailModal.tsx`, which does check `isProBoard` before showing Reactions/Activity). A first-time user on a board that has never used reviews sees three unexplained filter chips with no tooltip and no indication of what "Needs changes" even filters on, or that it's a Pro feature at all.

**Suggestion:** either hide the review filter chips when the board isn't using reviews (mirroring the Pro gate already used elsewhere on the same card), or give them the same one-line explainer treatment `HelpPanel` already uses for other non-obvious affordances.

### 4. Two nav items ("From the Founder", "Feedback/Features") occupy permanent top-level slots for content most users open rarely (guardrail item 1)

Both are desktop-only (not in `bottomNav`), so they're already partially deprioritized, but they're still two of the Sidebar's eight always-visible destinations, competing for attention with Today/Boards/To-Do/Calendar/Library on every page load. Neither is itself over-built — `CeoMessagePage` and `FeedbackPage` are simple, single-purpose pages — but per item 1, the question isn't whether the feature is good, it's whether it needs its *own permanent nav slot* versus living inside something that already exists (e.g. both could be entries inside `HelpPanel`'s tips list, or under Settings, with the nav slot reserved for things people open daily).

**Suggestion:** no action needed if these are intentionally kept visible for product/community reasons (that's a legitimate reason to keep them, and outside this audit's judgment to override) — flagging only because item 1 asks that every nav slot be re-justified, and these two are the only ones not part of the core planning workflow (Today/Boards/To-Do/Calendar/Library).

### 5. Settings stacks five full panels vertically with no wayfinding (guardrail item 2, minor)

Day/Night → Font pairing (6 cards) → Custom colors (8-tile grid + collapsed Advanced) → Calendar sync → Live preview is a long single-column scroll with no in-page navigation or section anchors. Each individual panel is well-designed (see "What's already working well" above), so this is a minor, cosmetic finding rather than a structural one — noted mainly because it's the one place in the app where several already-good, already-curated panels are simply concatenated rather than organized, and it will keep growing as more Pro settings are added (Calendar sync is itself a 2026-08-15-era addition to this same stack).

**Suggestion:** if more settings sections get added, consider a left-rail or tab structure before the page becomes a multi-screen scroll; not urgent at the current five-panel length.

## Not flagged

Explicitly checked and found to already match the guardrail:

- `TodosPage.tsx` recurrence UI (`RecurrenceEditor`) is reached one level deep (via the repeat icon), not a nav item or default-visible control — matches item 1.
- `CalendarPage.tsx`'s desktop/mobile split (`CalendarGrid` vs. `AgendaList`) is one view adapted to viewport, not two parallel views — avoids item 5's "second way to do the same thing."
- `LibraryPage.tsx`'s folder tree + search + drill-in navigation is a single, familiar file-explorer metaphor, not a bespoke one needing explanation — matches item 4.
- `OnboardingTour.tsx` is 6 slides, skippable at any point, shown once per device — proportionate, not a mandatory setup gate (item 3).
