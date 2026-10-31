# Aurora — Launch Series, Phase 1–4 (first 5 posts)

> Companion to `MARKETING.md` (source of truth for voice/§19, banned phrases/§20, no-competitor-names/§21, posting log/§33). This is a phase-based restructure of the launch content, requested specifically: go in depth on the product itself, not on the build story or the pentest. Log every post you actually publish in `MARKETING.md` §33 once it's live.
>
> Channel: LinkedIn personal profile, founder voice (first person). Post one at a time, in order — each closes with a question that sets up the next without naming it.
>
> **Note for Akash, not for posting:** `MARKETING.md` §11/§31/§33/§35 still shows the pentest as "not commissioned." You told me it's done and successful — Post 5 below reflects that as a plain fact (no invented findings or vendor detail, since I don't have those). Say the word and I'll update the tracked state in `MARKETING.md` to match reality, per its own §34 protocol.

---

## PHASE 1 — Why Aurora exists
### Post 1 — The problem, then the product
**utm_campaign:** `phase1-why-aurora` · **Image:** none, or the homepage above the fold

> Most people running a small team or a freelance practice aren't using one tool. They're using three or four — a board tool for tasks, a docs tool for notes, a whiteboard for anything visual, a calendar that agrees with none of them. Nothing talks to anything else, so keeping the truth straight becomes its own job.
>
> The other common failure is the opposite: one tool that tries to do everything, and a year in you need a tutorial to find the button you used yesterday.
>
> Aurora is my answer to both. Boards, a personal planner, a calendar, a document editor and a real-time whiteboard, in one workspace — and the calendar reads from the same cards and to-dos the boards do, so there's one version of "when," not four.
>
> It's live at aurora.nvexis.com, with a free tier to start on.
>
> I'll be posting about specific parts of it over the next few weeks — what's actually in it, what I got wrong, what I'm still unsure about. Starting with this: what's the piece of your current setup that quietly annoys you every week?

---

## PHASE 2 — Where the day's work happens
### Post 2 — Boards, planner, calendar as one system
**utm_campaign:** `phase2-operating-layer` · **Image:** board with columns/labels + calendar timeline view

> The core of Aurora is three surfaces that used to be three different tools for me: boards, a personal planner, and a calendar.
>
> Boards are boards — columns, drag-and-drop cards, checklists, labels, due dates. Nothing unusual there. What's different is the planner next to them: a personal daily list, separate from the shared board, because not everything you need to do belongs somewhere your whole team can see. Recurring tasks, bulk actions, the ordinary mechanics of a to-do list, done properly.
>
> The calendar is the part I actually care about. Month, week, day, and a timeline view — all four reading from the same cards and to-dos, not a separate system kept in sync by hand. Move a card to a different day and the calendar already knows. There's no "somewhere else" for it to disagree with.
>
> Cards also carry time tracking — start a timer on whatever you're working on, stop it, it totals per card, and it stays aware if more than one person is on the same card.
>
> None of this is a new idea individually. What I was trying to get right is that it's one system, not four adjacent ones that happen to share a login.
>
> What's the tool in your current setup most likely to go stale first — the one nobody remembers to update?

---

## PHASE 3 — Where the thinking happens
### Post 3 — Notes and the whiteboard
**utm_campaign:** `phase3-thinking-layer` · **Image:** a note with table of contents + formula, or the whiteboard mid-work with a second cursor visible

> Not all planning is a task list. Some of it is a document, and some of it is a shape you need to draw before it becomes tasks at all. Aurora has both, and they're built to work the same way.
>
> Notes is a block-based document editor — headings, tables, checklists, and math formulas you can write in LaTeX or build from a palette if you don't write LaTeX from memory. Every note gets a table of contents automatically, which sounds small until you're six pages into something and need to find a section.
>
> Canvas is an infinite whiteboard that stays in sync live, with someone else, on a different device — pressure-sensitive drawing, text boxes that use the same editor as Notes, images, tables, layers. Two people can draw on it at once and the changes merge instead of one person overwriting the other.
>
> I built the whiteboard last, and it's the feature I'm least certain earns its place in a project tool. My reasoning: a real share of planning work is a rough diagram before it's a list of tasks, and most tools make you leave to draw one — so the diagram ends up living somewhere the work doesn't.
>
> If you sketch things out before you plan them, where does that actually happen right now? Still a separate app, or has it mostly stopped happening?

---

## PHASE 4 — What it costs, and what backs it
### Post 4 — The price doesn't grow with your team
**utm_campaign:** `phase4-pricing` · **Image:** simple per-seat vs. flat arithmetic graphic, Almanac palette

> One decision in Aurora that I still think is right, even though it costs me money: it's priced per board, not per person.
>
> $5.99 a month covers up to ten people working on a board. Not $5.99 each — $5.99 total. Team is $22 a month for up to forty people, same rule.
>
> Almost everything in this category charges per seat, so the bill grows every time you add a contractor, a freelancer, or a client who just needs to see progress. I've watched teams get quietly protective about who gets a login for exactly that reason — a decision about who needs access turning into a decision about cost.
>
> The trade-off is real and I'll name it: a ten-person team pays the same as a solo user, so I make less from the accounts using Aurora hardest. I'd rather have the team on it than the extra margin, at this stage.
>
> If you've priced software before — did you go per-seat, and would you do it again?

### Post 5 — What's actually true right now
**utm_campaign:** `phase4-trust-ai-connector` · **Image:** none, or a screenshot of an AI session managing a board

> Two things about Aurora that don't show up in a feature list but matter more than most of what does.
>
> The first: every table in the database has row-level security, not just the interface — a paid limit that only lives in the UI is one devtools window away from not existing, so every gate is enforced twice. Payment state can only change through a signature-verified webhook; the browser is never trusted to say what someone paid for. There's a test suite whose only job is proving one account can't read another account's data. An independent penetration test on Aurora is complete now — the last item that was sitting between this and being properly ready for strangers.
>
> The second: you can connect an AI assistant directly to your own Aurora account and read or write your boards, to-dos and notes from inside it, through the same permission-enforced API the app itself uses. The access token is shown once and only its hash is stored, and every call authenticates through a short-lived key that's separate from your normal session and can be revoked on its own. It's a narrow use case — for people who already spend their day inside an AI assistant and would rather not switch tabs to move a card — but it's a real connection, not a chatbot bolted on top.
>
> Neither of these is the flashy part of the product. Both are the part I'd want to know about before trusting a new tool with my work.
>
> That's the four-phase rundown, done. What would actually get you to try it — or what's still missing that would stop you?

---

## Notes for whoever posts these

- All five checked against `MARKETING.md` §20 (banned phrases) and §21 (no competitor names) — clean.
- None lead with the 9-week build or the pentest as the hook, per the brief this file was written to. The build is implicit (first person, plain description); the pentest appears once, in Post 5, stated as a fact, not a badge.
- Post 5 references "an independent penetration test on Aurora is complete now" per what Akash reported. It does not claim a specific outcome (no findings count, no vendor name, no "zero critical issues") because none of that was given — if there's a real number worth citing, add it there and only there.
- Suggested order: one post every few days, in sequence — the phases build on each other (why → how it works day to day → where the thinking happens → what it costs and what backs it).
- Log each one in `MARKETING.md` §33 the day it goes up, with the `utm_campaign` value above.
