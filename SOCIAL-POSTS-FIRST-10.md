# Aurora — First 10 LinkedIn Posts + First 10 X Posts

> Companion to `MARKETING.md` (source of truth for voice, banned phrases, §21 no-competitor-names rule, and the posting log in §33). Pulled from §27's post bank plus new X-native drafts. Log every post you actually publish in `MARKETING.md` §33 — that's the memory that keeps future sessions from repeating you.
>
> Plan Day 1: Monday 31 August 2026. All copy follows §19 (voice) and §20 (banned phrases) — no "excited to announce," no emoji rows, no hashtag walls, no competitor names.

---

## LINKEDIN — first 10 posts

### 1. Personal — The build retrospective
**When:** Mon/Tue, Week 1 · **Angle:** build-in-public · **utm_campaign:** `w1-build-retro`

> I spent the last nine weeks building a project management app. It's live now, at aurora.nvexis.com.
>
> The honest version of how: I worked with AI coding agents for most of it, under a set of rules I wrote for myself before starting. Read the state document before touching anything. Update it after every change. Commit immediately. Never end a session with uncommitted work.
>
> Those rules mattered more than the speed did. The failure mode with AI coding isn't that it writes bad code — it's that you lose track of what exists. The state doc was the whole defence.
>
> What's in there now: boards, a personal daily planner, a calendar that reads from the same data as the boards rather than being its own thing, a document editor, and an infinite whiteboard that syncs live between people. 194 commits, 56 database migrations.
>
> What isn't there: any customers. Any reviews. An independent security audit — that's scoped and it's the next thing I'm paying for.
>
> If you run projects for a living, I'd genuinely like to know what your current setup gets wrong. Not as a lead-in to a pitch — I've built the thing already, and I'd rather find out now where it's wrong than in six months.

**Image:** 2–3 real screenshots — a board with cards, and the calendar's timeline view. No mockup frames.

---

### 2. Personal — Flat pricing
**When:** Thu, Week 1 · **Angle 1** · **utm_campaign:** `w1-flat-pricing`

> A pricing decision I made early and still think is the right one: Aurora charges per board, not per person.
>
> $5.99 a month covers up to ten people on a board. Not $5.99 each. Ten.
>
> Almost everything in this category charges per seat, which means the bill grows every time you bring in a contractor, a freelancer, or a client who just needs to look at something. I've watched small teams get quietly weird about who gets a login because of exactly that.
>
> The trade-off is real and I'll name it: flat pricing means a ten-person team pays the same as one person, so I make less from the accounts that use the product hardest. I decided I'd rather have the team than the margin, at least at this stage.
>
> Curious whether anyone has run the other way on this and regretted it. If you price software, how did you land on per-seat versus flat?

**Image:** simple pricing-arithmetic graphic in the Almanac palette (parchment `#ECE4D6` background, oxblood `#7A2A26` accent, Fraunces/IBM Plex Mono type) — a 5-person team, one year, per-seat vs. flat, side by side.

---

### 3. Nvexis company page — The introduction
**When:** Sat, Week 1 · **Brand voice (Track 1)** · **utm_campaign:** `w1-intro`

> Nvexis builds software that does what it says.
>
> The first product is Aurora — a workspace for project boards, a daily planner, a calendar, documents and a shared whiteboard, in one place. It's live at aurora.nvexis.com.
>
> Two decisions shape it more than any feature does.
>
> The first: the price doesn't scale with the number of people. One flat price per board, up to ten people on Pro and forty on Team. Adding someone to a board costs nothing.
>
> The second: every proposed feature gets checked against a written document before it's built, and that document has said no to real ideas that were already half-designed. The most common reason people abandon tools in this category isn't a missing feature — it's that the tool got too big to hold in your head.
>
> It's new. There aren't many of us yet. If you try it and something is wrong, we'd rather hear it early.

**Image:** the Aurora "A" monogram, or a hero screenshot of the app in light mode.

---

### 4. Personal — The dashboard bugs
**When:** Mon, Week 2 · **Angle:** candid, technical · **utm_campaign:** `w2-dashboard-bugs`

> I built an analytics dashboard for my app last week, reviewed the code, shipped it. Then I actually opened the page and found two bugs in about four minutes.
>
> The first: two database functions were declared read-only but were writing an audit-log row. Postgres was correctly refusing them. That's the kind of thing a code review slides right past because the declaration and the write are in different places.
>
> The second was worse and more interesting. The signup funnel showed zero completions past the first step. Not a small number — zero. Every real account in the window had signed up through Google's redirect flow, and my tracking had no way to tell a Google signup apart from someone just logging back in. The funnel wasn't broken. It was measuring a thing that couldn't happen.
>
> Both fixed the same day. But the lesson I keep relearning: reading the code tells you what it says. Loading the page tells you what it does.
>
> Anyone else have a favourite bug that only appeared when you used your own thing for real?

**Image:** a real screenshot of the `/analytics` dashboard.

---

### 5. Personal — The Simplicity Guardrail
**When:** Thu, Week 2 · **Angle 2** · **utm_campaign:** `w2-guardrail`

> I keep a document whose only job is to tell me no.
>
> Every feature I want to add to Aurora gets checked against it before I build it. It asks one question that matters: does this add a surface a new user has to learn on day one?
>
> It has actually stopped things. Goals were going to be a full objectives-and-key-results system. They're now a progress bar with a target date, because the honest answer was that nobody asked for the enterprise version. Automations were going to be a general if-this-then-that builder. They're three fixed behaviours, because open-ended rule builders are the most direct route to the exact complexity I'm trying to avoid.
>
> It has also overruled itself. The timeline view got flagged as bloat risk, then explicitly approved with a written reason. That's on the record too.
>
> The reason I'm writing this down publicly: anyone can say their tool is simple. Almost nobody can show you the document where they said no to themselves. I think the paper trail is the only version of that claim worth anything.
>
> If you build product — what's your version of this? Or do you think a written guardrail is just bureaucracy for a team of one?

**Image:** none needed, or a cropped screenshot of the actual `SIMPLICITY-GUARDRAIL.md` doc (a real artifact beats a designed graphic here).

---

### 6. Nvexis company page — One calendar
**When:** Sat, Week 2 · **Brand voice** · **utm_campaign:** `w2-one-calendar`

> Most tools in this category end up with a calendar that is quietly its own separate system. You put a date on a task in one place, and the calendar shows you something slightly different.
>
> Aurora's calendar reads from the same records as everything else. Month, week, day and a timeline view — four views, one source. Move a card to a different day and it moves everywhere, because there is no "everywhere else" to move it in.
>
> It sounds like an implementation detail. In practice it's the difference between a calendar you trust and one you check twice.

**Image:** calendar screenshot showing month view and the timeline/Gantt view together (side by side, or two frames).

---

### 7. Personal — The client link
**When:** Mon, Week 3 · **Persona 1 (freelancer)** · **utm_campaign:** `w3-client-link`

> A freelancer problem I built for specifically.
>
> A client asks "where are we on this?" and you either write the answer out by hand, or you give them a login to a tool they'll never open again — and on most per-seat pricing, that login costs you money every month.
>
> Aurora has a read-only share link. You send a URL, they see the board, they don't sign up for anything. Nothing is editable and nothing else in your account is visible.
>
> It took a couple of days to build and it's the feature I've been happiest with, because it removes a small recurring humiliation rather than adding a capability.
>
> Freelancers — how do you currently show a client progress? I'm curious whether the answer is still mostly a screenshot in an email.

**Image:** screenshot of the read-only shared board view (the client's-eye view).

---

### 8. Personal — The AI connector
**When:** Thu, Week 3 · **Angle 4** · **utm_campaign:** `w3-ai-connector`

> Something in Aurora I haven't seen elsewhere: you can connect an AI assistant directly to your own account and manage your boards from inside it.
>
> Not a chatbot bolted onto the product. An actual connection — your assistant reads and writes your boards, to-dos and notes through the same permission-enforced API the app itself uses.
>
> The auth is the part I'd want to know about if I were reading this. The token is shown once and only its hash is stored. A database trigger blocks anything but the server from writing that column. Every individual call is authenticated by a token that lives five minutes, minted from a signing key that's separate from the app's normal session key and can be revoked on its own.
>
> The use case is narrow and I'll admit that: it's for people who already spend their day in an AI assistant and would rather not switch tabs to move a card. That's a real person, but it isn't everyone.
>
> If you use an AI assistant for work daily — what would you actually want it to be able to reach into?

**Image:** screenshot or short screen recording of an AI session (Claude Desktop/Code) managing a board side by side with the app.

---

### 9. Personal — The security post
**When:** Sat, Week 3 or Mon, Week 4 · **Angle:** trust · **utm_campaign:** `w3-security`

> I want to be careful about how I talk about security, because "enterprise-grade" is a phrase that means nothing and I'd rather say what's actually true.
>
> What's true: every table in Aurora has row-level security. Every paid limit is enforced by the database as well as the interface, because a limit that only exists in the UI is one devtools window away from not existing. Payment state can only be written by a signature-verified webhook — the browser is never trusted to say what someone paid for. There's a test suite in CI whose entire job is proving one account can't read another account's data.
>
> What's not true yet: nobody independent has tried to break it. That test is scoped and budgeted and it's the next thing I'm spending money on, ahead of any advertising.
>
> I'd rather say that plainly than put a padlock icon on the landing page. If you've commissioned this kind of test before, I'd take any advice on choosing a firm.

**Image:** none needed. If you want one: a plain two-column "what's true / what's not yet" graphic in the Almanac palette — no padlock icons, no shield icons.

---

### 10. Personal — The whiteboard
**When:** Thu, Week 4 · **Angle 3 (design/craft)** · **utm_campaign:** `w4-whiteboard`

> The part of Aurora I most enjoyed building, and the part I was most sure I'd get wrong: an infinite whiteboard that stays in sync live between two people on different devices.
>
> Pressure-sensitive drawing, text boxes that use the same editor as the documents, images, tables, layers, live cursors. Two people drawing at once and it merges rather than one overwriting the other.
>
> The reason it's in a project management tool at all: about a third of planning work isn't a list. It's a diagram, or a rough shape of something before it becomes tasks. Most tools make you go somewhere else for that, and then the diagram lives in a different application from the work it describes.
>
> It's the feature I'd most like feedback on, because it's also the one I'm least sure earns its place. If you plan work visually — where does that actually happen for you right now?

**Image:** screenshot or short screen recording of the canvas mid-collaboration — two cursors visible, a mix of drawing/text/table.

---

## X (TWITTER) — first 10 posts

Account doesn't exist yet — create it in Week 1 (handle `@nvexisalmanac`, fallback `@thenvexisalmanac`). Expect near-zero reach on the first several posts; that's normal, the account needs history before Product Hunt/Show HN in Week 3. Post Wednesdays to start (§26), picking up to 2–3/week from Week 5.

### 1. Build retrospective (thread)
**When:** Wed, Week 2 (first X post) · **utm_campaign:** `w2-build-thread`

> **1/** Spent nine weeks building a project management app. It's live: aurora.nvexis.com
>
> Boards, a daily planner, a unified calendar, docs, and a whiteboard that syncs live between people. 194 commits, 56 migrations.
>
> Built working with AI coding agents. Here's what actually mattered ↓
>
> **2/** Not the speed. The rules.
>
> Before starting I wrote three: read the state doc before touching anything, update it after every change, commit immediately.
>
> The failure mode with AI coding isn't bad code. It's losing track of what exists.
>
> **3/** Every table has row-level security. Every paid limit is enforced in the database as well as the UI — a client-side-only gate is a devtools away from being bypassed.
>
> There's a test suite in CI whose only job is proving one account can't read another's data.
>
> **4/** The pricing is per board, not per seat. $5.99/mo covers ten people on a board. Not each.
>
> Everything comparable charges per person. The bill grows every time you add a contractor. That always seemed backwards to me.
>
> **5/** The genuinely unusual bit: you can connect an AI assistant directly to your own account and read/write your boards from inside it.
>
> Token hashed at rest, short-lived per-call auth from an independently revocable key. Real auth, not a scraped integration.
>
> **6/** What it doesn't have: customers, reviews, or an independent security audit. That last one is scoped and it's the next thing I'm paying for.
>
> If you try it and something's broken, tell me. I'd rather know now.

**Image:** tweet 1 — a real board screenshot. Tweet 5 — screenshot of an AI session moving a card.

---

### 2. Pricing arithmetic
**When:** Week 2–3 · **Angle 1** · **utm_campaign:** `pricing-arithmetic`

> Five people on a project tool at $10/seat/month is $600/year.
>
> Aurora is $22/month flat for up to 40 people on a board. $264/year, and it doesn't change when you add the sixth person.
>
> Per-seat pricing makes you think about who "deserves" a login. That always seemed like the wrong thing to be thinking about.

**Image:** the same pricing-arithmetic graphic as LinkedIn post #2 — reuse it, don't rebuild it.

---

### 3. The dashboard bugs (condensed)
**When:** Week 2–3 · **utm_campaign:** `x-dashboard-bugs`

> Shipped an analytics dashboard last week. Reviewed the code, opened the page, found two bugs in four minutes.
>
> One: a "read-only" function was silently trying to write an audit row. Postgres correctly blocked it.
>
> Two: the signup funnel showed zero completions — because every real signup came through Google's redirect, which my tracking couldn't tell apart from a login. Not broken. Measuring the wrong thing.
>
> Reading the code tells you what it says. Loading the page tells you what it does.

**Image:** screenshot of the dashboard (same as LinkedIn #4, cropped tighter for X).

---

### 4. The Simplicity Guardrail (condensed)
**When:** Week 3 · **Angle 2** · **utm_campaign:** `x-guardrail`

> I keep a document whose only job is to tell me no.
>
> Every feature gets checked against one question before it's built: does this add a surface a new user has to learn on day one?
>
> Goals could've been a full OKR system. It's a progress bar. Automations could've been a general rule builder. It's three fixed behaviours.
>
> Anyone can say their tool is simple. Fewer people can show you the doc where they said no to themselves.

**Image:** none, or a cropped screenshot of the actual guardrail doc.

---

### 5. The AI connector (standalone)
**When:** Week 3 · **Angle 4** · **utm_campaign:** `x-ai-connector`

> You can connect an AI assistant to your Aurora account and manage boards from inside it — not a chatbot bolted on, the same permission-enforced API the app itself uses.
>
> Token hashed at rest. Every call auth'd by a 5-minute token from a separately revocable signing key.
>
> If you live in an AI assistant all day — what would you actually want it to reach into?

**Image:** screenshot/GIF of the AI session managing a board (same asset as LinkedIn #8).

---

### 6. The client link
**When:** Week 3–4 · **Persona 1** · **utm_campaign:** `x-client-link`

> Built this for freelancers specifically: a read-only share link for a board. Send a URL, the client sees progress, nobody signs up, nothing else in your account is visible.
>
> No more "here's a screenshot" email. No more paying per seat for a login someone opens once.

**Image:** the client's-eye view screenshot (same as LinkedIn #7).

---

### 7. The whiteboard — screenshot-led
**When:** Week 4 · **Angle 3** · **utm_campaign:** `x-whiteboard`

> An infinite whiteboard that stays in sync live, between two people, on two devices.

**Image:** this post is the screenshot/short screen recording — canvas mid-collaboration, two live cursors visible. Minimal text, let the image do the work (§22 angle 3 explicitly says "attach nothing else").

---

### 8. The security post (condensed)
**When:** Week 4 · **utm_campaign:** `x-security`

> Not calling this "enterprise-grade" — that phrase means nothing. What's actually true: every table has row-level security, every paid limit is enforced in the database (not just the UI), and CI has a test suite whose only job is proving one account can't read another's data.
>
> What's not true yet: no independent audit. Scoped, and it's next — ahead of any ads.

**Image:** none.

---

### 9. What I got wrong (thread)
**When:** Week 4–5 · **Angle:** candid · **utm_campaign:** `x-what-i-got-wrong`

> **1/** Three things I got wrong building Aurora, now that there's distance to see them.
>
> **2/** The free tier was too generous. Ten boards, three collaborators — that's a whole small team running free forever. Cut it to three and two. Felt bad, was obviously correct.
>
> **3/** Built the settings page backwards — led with a raw colour picker, people (including me) made ugly things with it. Rebuilt around eight curated presets, colour wheel hidden behind "advanced."
>
> **4/** Left marketing until the product was finished. Nine weeks building, zero weeks of anyone knowing it exists. Product risk was mostly retired by then. Distribution risk was still entirely ahead of me — and it's the bigger one.

**Image:** none needed, or a before/after of the settings page for tweet 3.

---

### 10. Calm / anti-overwhelm (reflective)
**When:** Week 5 · **Angle 2** · **utm_campaign:** `x-calm`

> The most-cited reason people abandon a project tool isn't a missing feature. It's that the tool got too complicated to open.
>
> Everything I've added to Aurora since week one has had to answer one question first: does this cost a new user anything to learn on day one? Most of what I wanted to build didn't survive that question.

**Image:** none.

---

## General image rules (all posts)

- Real product screenshots beat designed graphics almost everywhere — the Almanac visual identity (warm parchment `#ECE4D6`, oxblood `#7A2A26` accent, Fraunces/Spectral/IBM Plex Mono type) already looks unlike the rest of the category, so a plain screenshot does real work on its own.
- When you do need a designed graphic (pricing arithmetic, a quote card), keep it flat, bold, high-contrast — the app's glassmorphism/frosted-glass treatment is for the product itself, not a 1080×1080 image viewed at thumbnail size.
- Never Inter, never Space Grotesk — banned pre-rebrand fonts. No violet/cyan gradients, no sparkle iconography, no padlock/shield clip-art for the security posts.
- No mockup device frames around screenshots — the real UI is the asset.
- Light mode is the hero for anything public-facing.

## Before you post

1. Check `MARKETING.md` §33 (POSTING LOG) first — don't duplicate something already published.
2. After publishing, log it in §33 (one line: date, ID, platform, angle, summary, link) and update the running-state block underneath it. That's the entire maintenance burden and it's what makes the next session (or the next me) useful instead of repetitive.
3. Tag the UTM campaign values above on every link so §32's funnel measurement actually works.
