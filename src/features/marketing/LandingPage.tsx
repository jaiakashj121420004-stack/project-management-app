import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { captureLandingAttribution, track } from '@/lib/analytics';
import { springs } from '@/lib/motion';
import {
  ArrowRight,
  Bot,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  LayoutGrid,
  Library as LibraryIcon,
  Palette,
  PenTool,
  ShieldCheck,
  Target,
  Type,
  type LucideIcon,
} from 'lucide-react';
import {
  BoardMockup,
  EditorMockup,
  CanvasMockup,
  CalendarMockup,
  PaletteMockup,
} from './lodestar/Mockups';
import { PLANS, PLAN_ORDER, PRO_MEMBER_LIMIT, TEAM_MEMBER_LIMIT, ENTERPRISE_CONTACT_EMAIL } from '@/lib/plans';
import './lodestar.css';
import { AVAILABLE_SHOTS } from 'virtual:available-shots';

const MARK = '/brand/aurora-mark.svg';

/**
 * Shows a real app screenshot from /public/shots/<name>.png if it exists; until
 * you drop the file in, it gracefully falls back to the styled faux mockup. So
 * the site looks great now AND upgrades to real screenshots the moment they land.
 */
function Shot({
  src,
  children,
}: {
  src: string;
  children: ReactNode;
}) {
  // Skip the network request entirely for a shot that build-time (see
  // vite.config.ts's availableShotsPlugin) already knows isn't in
  // public/shots/ — avoids a guaranteed-404 fetch on every landing-page
  // visit (was costing 6 wasted requests per load, 2 of them effectively
  // eager since they sit above the fold). Once a real PNG is dropped in and
  // the site rebuilds, this starts true→false automatically, no code change
  // needed, and onError below still covers a shot that's listed but fails
  // to load for some other reason.
  const filename = src.slice(src.lastIndexOf('/') + 1);
  const [failed, setFailed] = useState(() => !AVAILABLE_SHOTS.has(filename));
  if (failed) return <>{children}</>;
  // Real screenshots aren't in public/shots/ yet (see that folder's README),
  // so in production every visit currently 404s and falls back to `children`
  // — but before that error resolves, this <img> has no intrinsic size and
  // renders at ~0 height, then the page reflows once the mockup swaps in.
  // `aspect-[8/5]` reserves that height up front (~268px tall at this grid's
  // column width, matching the mockup's own fixed minHeight) so the swap
  // doesn't move anything below it. Real, measured regression this fixes:
  // Phase 7 Lighthouse audit (2026-08-23) traced 0.234 of a 0.331 total CLS
  // score to exactly this element.
  //
  // Tried eager-loading + fetchPriority="high" on the two above-the-fold
  // (Hero) instances on 2026-08-23 to speed up the onError→mockup swap —
  // measured WORSE on a fresh mobile re-run (Performance 61 → 53, LCP got
  // longer): forcing the browser to prioritize two guaranteed-404 fetches
  // ahead of real render-critical resources on throttled mobile network cost
  // more than it saved. Reverted back to plain `loading="lazy"` for all
  // instances, which is the measured-good baseline (61).
  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
      className="lode-window aspect-[8/5] w-full object-cover object-top"
    />
  );
}

/**
 * The public landing page — the front door of Aurora (the product; Nvexis is
 * the company). A warm, editorial parchment page showcasing every part of the
 * app, on the brand palette + gilt accent, bookended by a dark nav/footer.
 * Faux app windows stand in for screenshots (see lodestar/Mockups.tsx — the
 * folder keeps its internal name; nothing user-facing reads "Lodestar").
 *
 * Copy throughout follows MARKETING.md §19–§21: plain and concrete rather than
 * hype-y, no competitor names anywhere (not even descriptively — see the
 * substitution table in §21), and every claim here is something the product
 * actually does today. Nothing is invented; nothing is a testimonial we don't
 * have yet.
 */
export function LandingPage() {
  // First funnel moment: capture first-touch UTM/referrer once per browser (a
  // no-op on repeat visits — see captureLandingAttribution), then record the
  // view itself. This also fires for signed-in visitors on /preview, which is
  // fine — it's a real page view either way, and the event carries no PII.
  useEffect(() => {
    captureLandingAttribution();
    track('landing_page_viewed');
  }, []);

  return (
    <div className="lode min-h-dvh bg-[color:var(--lode-parchment)] font-body antialiased">
      <Nav />
      {/* Phase 7 Lighthouse audit (2026-08-23): this route renders standalone
          (not through MarketingLayout, which already wraps its children in a
          <main>), so it had no landmark of its own — added here rather than
          switching to MarketingLayout, since Nav/Footer here are this page's
          own <header>/<footer>, not the shared marketing chrome. */}
      <main>
        <Hero />
        <StatBand />
        <Spotlights />
        <FeatureExplorer />
        <Guardrail />
        <CollaborationBand />
        <Pricing />
        <SecurityNote />
        <MakersNote />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}

/* ---- Nav ------------------------------------------------------------------ */
function Nav() {
  return (
    <header className="lode-night sticky top-0 z-40 border-b border-[rgba(255,245,225,0.08)] backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <Link to="/" className="flex items-center gap-2">
          <img src={MARK} alt="" className="h-7 w-7" />
          <span className="font-display text-lg font-bold text-[color:var(--lode-parchment)]">Aurora</span>
        </Link>
        <nav className="hidden items-center gap-7 text-sm text-[rgba(236,228,214,0.75)] md:flex">
          <a href="#features" className="hover:text-[color:var(--lode-parchment)]">Features</a>
          <a href="#collaborate" className="hover:text-[color:var(--lode-parchment)]">Collaborate</a>
          <a href="#pricing" className="hover:text-[color:var(--lode-parchment)]">Pricing</a>
        </nav>
        <div className="flex items-center gap-2">
          <Link
            to="/login"
            className="hidden rounded-xl px-3.5 py-2 text-sm text-[rgba(236,228,214,0.85)] hover:bg-white/5 sm:block"
          >
            Sign in
          </Link>
          <Link to="/signup" className="lode-cta text-sm">
            Get started <ArrowRight size={15} />
          </Link>
        </div>
      </div>
    </header>
  );
}

/* ---- Hero ----------------------------------------------------------------- */
function Hero() {
  return (
    <section className="lode-paper relative px-4 pb-24 pt-16 sm:px-6 sm:pt-24">
      <div className="mx-auto max-w-3xl text-center">
        <div className="lode-glow mx-auto mb-7 w-fit">
          <img src={MARK} alt="Aurora" className="mx-auto h-16 w-16" />
        </div>
        <p className="lode-eyebrow mb-4 text-[color:var(--lode-oxblood-deep)]">Aurora · by Nvexis</p>
        <h1 className="font-display text-4xl font-black leading-[1.05] text-[color:var(--lode-ink)] sm:text-6xl">
          Boards, docs, canvas and a calendar — <span className="lode-gilt">one workspace, one price.</span>
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-lg text-[color:rgba(34,26,20,0.72)]">
          Aurora puts Kanban boards, a block-based document editor, an infinite collaborative
          canvas, a calendar and a daily planner in one calm place — instead of three or four
          tools that don't agree with each other. Free to start. No credit card.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link to="/signup" className="lode-cta text-base">
            Start free <ArrowRight size={17} />
          </Link>
          <a
            href="#features"
            className="rounded-xl border border-[rgba(122,42,38,0.3)] px-5 py-2.5 text-[color:var(--lode-ink)] transition-colors hover:bg-[rgba(122,42,38,0.06)]"
          >
            See what's inside
          </a>
        </div>
        <p className="mt-4 font-mono text-xs uppercase tracking-widest text-[color:rgba(34,26,20,0.6)]">
          Works on mobile + desktop · Installs like a native app
        </p>
      </div>

      {/* Flagship montage */}
      <div className="mx-auto mt-14 grid max-w-5xl gap-4 sm:grid-cols-2">
        <div className="sm:mt-8"><Shot src="/shots/board.png"><BoardMockup /></Shot></div>
        <div><Shot src="/shots/editor.png"><EditorMockup /></Shot></div>
      </div>
    </section>
  );
}

/* ---- Stat band -------------------------------------------------------------
 * Four concrete, checkable facts rather than vague superlatives — see
 * MARKETING.md §5 "concrete over abstract, always". Every number here is
 * something a visitor can go verify on the pricing page in ten seconds. */
function StatBand() {
  const stats: [string, string][] = [
    ['1 price', 'per board — not per person'],
    [`${PRO_MEMBER_LIMIT}`, 'people on a Pro board, same $5.99/mo'],
    ['5-in-1', 'boards, docs, canvas, calendar & planner'],
    ['$0', 'to start — a genuinely usable free plan'],
  ];
  return (
    <section className="lode-paper border-y border-[rgba(122,42,38,0.14)] px-4 py-8 sm:px-6">
      <div className="mx-auto grid max-w-5xl grid-cols-2 gap-6 text-center sm:grid-cols-4">
        {stats.map(([n, label]) => (
          <div key={label}>
            <p className="font-display text-3xl font-black lode-gilt">{n}</p>
            <p className="mt-1 text-xs text-[color:rgba(34,26,20,0.6)]">{label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---- Feature spotlights (parchment) --------------------------------------- */
function Spotlight({
  eyebrow,
  title,
  body,
  points,
  mockup,
  reverse = false,
}: {
  eyebrow: string;
  title: string;
  body: string;
  points: string[];
  mockup: ReactNode;
  reverse?: boolean;
}) {
  return (
    <div className="grid items-center gap-8 md:grid-cols-2">
      <div className={reverse ? 'md:order-2' : ''}>
        <p className="lode-eyebrow text-[color:var(--lode-oxblood-deep)]">{eyebrow}</p>
        <h3 className="mt-2 font-display text-3xl font-bold text-[color:var(--lode-ink)]">{title}</h3>
        <p className="mt-3 text-[color:rgba(34,26,20,0.72)]">{body}</p>
        <ul className="mt-4 space-y-2">
          {points.map((p) => (
            <li key={p} className="flex items-start gap-2 text-sm text-[color:rgba(34,26,20,0.82)]">
              <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-[color:var(--lode-oxblood)]" />
              {p}
            </li>
          ))}
        </ul>
      </div>
      <div className={reverse ? 'md:order-1' : ''}>{mockup}</div>
    </div>
  );
}

function Spotlights() {
  return (
    <section id="features" className="lode-paper px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-3xl text-center">
        <p className="lode-eyebrow text-[color:var(--lode-oxblood-deep)]">Everything, in one place</p>
        <h2 className="mt-2 font-display text-3xl font-black text-[color:var(--lode-ink)] sm:text-4xl">
          A whole workspace that finally feels like one thing.
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-[color:rgba(34,26,20,0.7)]">
          The most common reason people abandon a project tool isn't a missing feature — it's that
          the tool got too complicated to open, or it's really three tools stitched together that
          quietly disagree with each other. Aurora is built against both.
        </p>
      </div>
      <div className="mx-auto mt-16 flex max-w-5xl flex-col gap-20">
        <Spotlight
          eyebrow="Boards"
          title="Kanban that gets out of your way"
          body="Drag cards across columns, set due dates and priorities, attach checklists and labels. Multiple projects, each its own board — and the bill doesn't change when you add the sixth person."
          points={['Drag-and-drop columns & cards', 'Due dates, priorities, checklists, labels', 'Assignees + a calendar that reads the same data']}
          mockup={<Shot src="/shots/board.png"><BoardMockup /></Shot>}
        />
        <Spotlight
          reverse
          eyebrow="Library + Editor"
          title="A block-based document editor, organised like a file explorer"
          body="Standalone notes and canvases live in one nested Library. Write with a real block editor — slash commands, toggles, task lists, custom colours, emoji, drag-to-reorder — the same editor that powers every text box on the canvas, too."
          points={['Infinite folders for notes + canvases', '"/" slash menu, toggles, task lists, colours', 'Full-text search across your whole Library']}
          mockup={<Shot src="/shots/editor.png"><EditorMockup /></Shot>}
        />
        <Spotlight
          eyebrow="Canvas · Pro"
          title="An infinite whiteboard that thinks with you"
          body="Pressure-sensitive pen, marker and highlighter, shapes and text, images, audio and video — and live multiplayer cursors so a team can sketch together in real time, with edits that merge instead of overwrite."
          points={['Freehand ink, media, embeds', 'Live cursors + real-time co-editing', 'Minimap, fit-to-content, page styles']}
          mockup={<Shot src="/shots/canvas.png"><CanvasMockup /></Shot>}
        />
      </div>
    </section>
  );
}

/* ---- Feature explorer: every feature, in an accordion ---------------------
 * The full feature inventory (MARKETING.md §8), grouped into eight categories
 * a visitor can open one at a time rather than scrolling past a wall of text.
 * Nothing named here is a competitor's product — see §21. */
interface Pillar {
  icon: LucideIcon;
  title: string;
  intro: string;
  points: string[];
}

const PILLARS: Pillar[] = [
  {
    icon: LayoutGrid,
    title: 'Boards & teamwork',
    intro: 'Kanban that scales from a solo to-do list to a whole team’s review pipeline.',
    points: [
      'Drag-drop columns & cards across multiple projects',
      'Due dates (and due times on Pro), priorities, checklists, labels, assignees',
      'Review flow: request → approve / needs-changes, with status filters',
      'Threaded comments with @mentions + emoji reactions',
      'Per-project activity log + a live notification bell',
      'Presence avatars show who’s viewing; changes sync live',
      'Owner / editor / viewer roles, enforced in the database — not just hidden buttons',
    ],
  },
  {
    icon: CalendarDays,
    title: 'Calendar & reminders',
    intro: 'Four views over one truth, not four systems pretending to agree.',
    points: [
      'Month, Week, Day and a Timeline/Gantt view — all reading the same cards and to-dos',
      'Drag a card to a new day to reschedule it; drag or resize a timeline bar to change its span',
      'A colour-coded legend appears automatically once more than one project is in view',
      'Due-date reminders by email and browser notification',
      'Pro: custom reminder timing and channels, plus an ICS feed your own calendar app can subscribe to',
    ],
  },
  {
    icon: Type,
    title: 'A block-based document editor',
    intro: 'The same editor powers standalone notes and every text box on the canvas.',
    points: [
      'Press "/" for a slash menu that inserts any block',
      'Headings, quotes, code blocks, dividers',
      'Bullet, numbered, lettered and Roman-numeral lists — nested',
      'Task lists with real checkboxes that strike through when done',
      'Toggle / collapsible blocks to fold away detail',
      'Math formulas (inline and block) with a click-to-edit live preview',
      'Custom text colours and highlight colours, an emoji autocomplete, and safe sanitised links',
      'Auto-generated, clickable table of contents per note',
      'Export to Markdown (free), Word and PDF (Pro)',
      'Everything autosaves as you type',
    ],
  },
  {
    icon: PenTool,
    title: 'An infinite canvas',
    intro: 'A whiteboard that stays in sync live, with another person, on another device.',
    points: [
      'Infinite pan & zoom; ruled, grid, dotted or blank pages',
      'Pressure-sensitive pen, marker & translucent highlighter, with two erasers',
      'Rich text boxes using the same block editor as your notes',
      'Images: paste, drag-drop, or upload; audio & video: record in-app, upload, or embed',
      'Multi-select, group move, z-order, lock, duplicate, and a layers panel',
      'Minimap, fit-to-content, and reset view for navigating big boards',
      'Live multiplayer cursors — concurrent edits merge rather than clobber each other',
    ],
  },
  {
    icon: LibraryIcon,
    title: 'Library, search & organization',
    intro: 'One nested folder tree holds your notes and canvases together, like a real file explorer.',
    points: [
      'Infinite subfolders holding both notes and canvases',
      'Standalone notes (independent of any project) plus per-project notes',
      'Rename, move to any folder, delete, and search across everything',
      'Share a note or canvas by email as editor or viewer',
      'Full-text search across every card and note, surfaced in one ⌘K command palette',
      'A single familiar way to jump between projects, notes, canvases and folders',
    ],
  },
  {
    icon: Target,
    title: 'Goals, automations & time',
    intro: 'Track the outcome, automate the busywork, and account for the hours — without a config screen in sight.',
    points: [
      'Lightweight progress-bar goals — a title, a target date, and a percentage. Deliberately not a heavyweight OKR system.',
      'A small, fixed set of automation rules — "when a card moves to Done, assign it to…" — not a general rule builder',
      'Recurring cards on a schedule, wired to the same planner engine as your daily to-dos',
      'Per-card time tracking: start/stop, a running total, one active timer at a time',
      'A personal daily/weekly to-do planner with its own recurrence rules, separate from shared boards',
      'Starter templates, so a fresh board or list is never a blank page',
    ],
  },
  {
    icon: Bot,
    title: 'Connect your AI assistant, bring your work in',
    intro: 'Reach Aurora from tools you already use — and don’t start from zero.',
    points: [
      'Pro & Team: connect Claude Desktop or Claude Code directly to your account and read or write boards, to-dos and notes through the same permission-enforced API the app itself uses',
      'Auth built for that: a token shown once, only its hash stored, and every call authenticated by a short-lived key you can revoke on its own',
      'A client-facing, no-account-required read-only share link — send a URL, they see the board, nobody signs up',
      'One-time board import from another tool’s JSON export, or from CSV, into a brand-new Aurora project — one-way, so trying Aurora costs you nothing to reverse',
    ],
  },
  {
    icon: Palette,
    title: 'Make it yours, everywhere',
    intro: 'The small details that make a tool feel like it’s actually yours.',
    points: [
      'Day and Night themes, both fully designed — not an afterthought toggle',
      'Font pairing (free) and a custom accent colour (Pro), with eight curated presets up front',
      'Preferences sync to your account, not just one device',
      'Installs from any browser on desktop or mobile, like a native app',
      'Offline caching, so you can keep reading when you lose signal',
    ],
  },
];

function AccordionRow({ pillar, open, onToggle }: { pillar: Pillar; open: boolean; onToggle: () => void }) {
  const { icon: Icon, title, intro, points } = pillar;
  return (
    <div className="lode-card overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-4 p-5 text-left"
      >
        <span
          className="grid h-11 w-11 shrink-0 place-items-center rounded-xl"
          style={{ background: 'rgba(194,74,64,0.12)', color: 'var(--lode-oxblood)' }}
        >
          <Icon size={20} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-display text-lg font-bold text-[color:var(--lode-ink)]">{title}</span>
          <span className="mt-0.5 block text-sm text-[color:rgba(34,26,20,0.65)]">{intro}</span>
        </span>
        <ChevronDown
          size={20}
          className="shrink-0 text-[color:rgba(34,26,20,0.5)] transition-transform duration-200"
          style={{ transform: open ? 'rotate(180deg)' : undefined }}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={springs.snappy}
            className="overflow-hidden"
          >
            <ul className="space-y-2 px-5 pb-6 pl-[4.25rem]">
              {points.map((p) => (
                <li key={p} className="flex items-start gap-2 text-sm text-[color:rgba(34,26,20,0.82)]">
                  <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-[color:var(--lode-oxblood)]" />
                  {p}
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function FeatureExplorer() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  return (
    <section className="lode-paper px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-3xl text-center">
        <p className="lode-eyebrow text-[color:var(--lode-oxblood-deep)]">Every feature, in full</p>
        <h2 className="mt-2 font-display text-3xl font-black text-[color:var(--lode-ink)] sm:text-4xl">
          Deceptively simple. Seriously deep.
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-[color:rgba(34,26,20,0.7)]">
          Everything shipped and live today, grouped by what you're trying to do. Open a section to
          see the whole list.
        </p>
      </div>
      <div className="mx-auto mt-12 flex max-w-3xl flex-col gap-3">
        {PILLARS.map((pillar, i) => (
          <AccordionRow
            key={pillar.title}
            pillar={pillar}
            open={openIndex === i}
            onToggle={() => setOpenIndex((current) => (current === i ? null : i))}
          />
        ))}
      </div>
    </section>
  );
}

/* ---- The Simplicity Guardrail (angle 2) ------------------------------------
 * Anyone can claim their tool is simple. This section shows the mechanism
 * instead of the adjective — see MARKETING.md §8 and §22 angle 2. */
function Guardrail() {
  return (
    <section className="lode-paper border-y border-[rgba(122,42,38,0.14)] px-4 py-20 sm:px-6">
      <div className="mx-auto grid max-w-5xl items-center gap-10 md:grid-cols-2">
        <div>
          <p className="lode-eyebrow text-[color:var(--lode-oxblood-deep)]">Why it stays simple</p>
          <h2 className="mt-2 font-display text-3xl font-black text-[color:var(--lode-ink)] sm:text-4xl">
            Every feature is checked against one question before it's built.
          </h2>
          <p className="mt-4 text-[color:rgba(34,26,20,0.72)]">
            Does this add a surface a new user has to learn on day one? If the honest answer is
            yes, the feature gets smaller — not the checklist.
          </p>
          <ul className="mt-5 space-y-3">
            <li className="flex items-start gap-2 text-sm text-[color:rgba(34,26,20,0.82)]">
              <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-[color:var(--lode-oxblood)]" />
              Goals could have been a full objectives-and-key-results system. It's a progress bar
              with a target date.
            </li>
            <li className="flex items-start gap-2 text-sm text-[color:rgba(34,26,20,0.82)]">
              <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-[color:var(--lode-oxblood)]" />
              Automations could have been a general if-this-then-that builder. It's three fixed
              behaviours that read as a plain sentence.
            </li>
            <li className="flex items-start gap-2 text-sm text-[color:rgba(34,26,20,0.82)]">
              <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-[color:var(--lode-oxblood)]" />
              The rule cuts both ways — it's also overruled itself, in writing, when a feature
              earned its place.
            </li>
          </ul>
        </div>
        <div className="lode-card p-8 text-center">
          <p className="font-display text-xl font-semibold leading-snug text-[color:var(--lode-ink)]">
            "Most tools in this category keep adding surface area until the tool itself becomes
            the thing you have to manage."
          </p>
          <p className="mt-4 text-sm text-[color:rgba(34,26,20,0.6)]">That's the failure mode this rule exists to prevent.</p>
        </div>
      </div>
    </section>
  );
}

/* ---- Collaboration band ----------------------------------------------------- */
function CollaborationBand() {
  return (
    <section id="collaborate" className="lode-paper px-4 py-20 sm:px-6">
      <div className="mx-auto grid max-w-5xl items-center gap-10 md:grid-cols-2">
        <div>
          <p className="lode-eyebrow text-[color:var(--lode-oxblood-deep)]">Better together</p>
          <h2 className="mt-2 font-display text-3xl font-black text-[color:var(--lode-ink)] sm:text-4xl">
            Work with your team, live.
          </h2>
          <p className="mt-3 text-[color:rgba(34,26,20,0.72)]">
            Invite people to a board, a canvas, or a single note. See who's here with presence
            avatars, co-edit the canvas with live cursors, comment and @mention, request reviews,
            and follow an activity log — with a notification bell for everything aimed at you.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {['Presence', 'Live cursors', '@mentions', 'Reactions', 'Review flow', 'Activity log'].map((t) => (
              <span key={t} className="lode-chip">{t}</span>
            ))}
          </div>
        </div>
        <div className="grid gap-4">
          <Shot src="/shots/canvas.png"><CanvasMockup /></Shot>
          <div className="grid grid-cols-2 gap-4">
            <Shot src="/shots/calendar.png"><CalendarMockup /></Shot>
            <Shot src="/shots/palette.png"><PaletteMockup /></Shot>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---- Pricing ----------------------------------------------------------------
 * Sourced directly from `@/lib/plans` (the same source of truth the real
 * /pricing page and the billing UI read from) rather than a second, hand-typed
 * copy — a prior version of this section hardcoded "Pro $8/mo" and had no Team
 * card at all, silently drifting from the real $5.99 Pro / $22 Team pricing as
 * those changed on 2026-08-12. Sourcing from PLANS makes that class of drift
 * structurally impossible: this section now shows whatever the app actually
 * charges. */
const PLAN_CTA: Record<'free' | 'pro' | 'team', string> = {
  free: 'Start free',
  pro: 'Go Pro',
  team: 'Go Team',
};

function formatPrice(n: number): string {
  return Number.isInteger(n) ? `$${n}` : `$${n.toFixed(2)}`;
}

function Pricing() {
  const perSeatFiveYear = 5 * 10 * 12; // illustrative: 5 people, $10/seat/mo, one year
  const teamYear = PLANS.team.priceMonthly * 12;
  return (
    <section id="pricing" className="lode-paper px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-3xl text-center">
        <p className="lode-eyebrow text-[color:var(--lode-oxblood-deep)]">Simple pricing</p>
        <h2 className="mt-2 font-display text-3xl font-black text-[color:var(--lode-ink)] sm:text-4xl">
          Priced per board. Not per person.
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-[color:rgba(34,26,20,0.7)]">
          Most tools in this category charge per seat, so the bill grows every time you add a
          contractor, a freelancer, or a client who just needs to look at something. Aurora
          doesn't. Pro is {formatPrice(PLANS.pro.priceMonthly)}/mo for up to {PRO_MEMBER_LIMIT} people
          on a board. Team is {formatPrice(PLANS.team.priceMonthly)}/mo for up to {TEAM_MEMBER_LIMIT}.
          Not each — total.
        </p>
        <div className="mx-auto mt-8 grid max-w-md grid-cols-2 gap-4 rounded-2xl border border-[rgba(122,42,38,0.16)] bg-[rgba(255,253,248,0.6)] p-5 text-left">
          <div>
            <p className="text-xs uppercase tracking-wide text-[color:rgba(34,26,20,0.55)]">A typical per-seat tool</p>
            <p className="mt-1 font-display text-2xl font-bold text-[color:var(--lode-ink)]">${perSeatFiveYear}<span className="text-sm font-medium text-[color:rgba(34,26,20,0.6)]">/yr</span></p>
            <p className="mt-1 text-xs text-[color:rgba(34,26,20,0.55)]">5 people, $10/seat/mo — illustrative</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-[color:var(--lode-oxblood-deep)]">Aurora Team</p>
            <p className="mt-1 font-display text-2xl font-bold text-[color:var(--lode-ink)]">${teamYear}<span className="text-sm font-medium text-[color:rgba(34,26,20,0.6)]">/yr</span></p>
            <p className="mt-1 text-xs text-[color:rgba(34,26,20,0.55)]">up to {TEAM_MEMBER_LIMIT} people, flat</p>
          </div>
        </div>
      </div>
      <div className="mx-auto mt-10 grid max-w-4xl gap-4 sm:grid-cols-3">
        {PLAN_ORDER.map((id) => (
          <PlanCard
            key={id}
            name={PLANS[id].name}
            price={formatPrice(PLANS[id].priceMonthly)}
            period={PLANS[id].priceMonthly > 0 ? '/mo' : undefined}
            tagline={PLANS[id].tagline}
            points={PLANS[id].features}
            cta={PLAN_CTA[id]}
            to="/signup"
            highlight={id === 'pro'}
          />
        ))}
      </div>
      <p className="mx-auto mt-6 max-w-xl text-center text-xs text-[color:rgba(34,26,20,0.55)]">
        Need more than {PLANS.team.memberLimit} people on one board? <a href={`mailto:${ENTERPRISE_CONTACT_EMAIL}`} className="underline decoration-[rgba(122,42,38,0.4)] underline-offset-2 hover:text-[color:var(--lode-oxblood-deep)]">Talk to us about Enterprise</a>.
      </p>
    </section>
  );
}

function PlanCard({
  name, price, period, tagline, points, cta, to, highlight = false,
}: {
  name: string; price: string; period?: string; tagline: string; points: string[]; cta: string; to: string; highlight?: boolean;
}) {
  return (
    <div
      className="lode-card relative flex flex-col p-6"
      style={highlight ? { borderColor: 'var(--lode-gold)', boxShadow: '0 24px 60px -30px rgba(184,144,47,0.5)' } : undefined}
    >
      {highlight && (
        <span
          className="lode-chip absolute -top-3 left-6 bg-[#fdfaf4]"
          style={{ color: 'var(--lode-oxblood-deep)', borderColor: 'rgba(122,42,38,0.35)' }}
        >
          Best value
        </span>
      )}
      <p className="font-display text-lg font-bold text-[color:var(--lode-ink)]">{name}</p>
      <p className="mt-1 text-sm text-[color:rgba(34,26,20,0.6)]">{tagline}</p>
      <p className="mt-4 font-display text-4xl font-black text-[color:var(--lode-ink)]">
        {price}<span className="text-base font-medium text-[color:rgba(34,26,20,0.72)]">{period}</span>
      </p>
      <ul className="mt-5 flex-1 space-y-2">
        {points.map((p) => (
          <li key={p} className="flex items-start gap-2 text-sm text-[color:rgba(34,26,20,0.82)]">
            <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-[color:var(--lode-oxblood)]" /> {p}
          </li>
        ))}
      </ul>
      <Link to={to} className={`lode-cta mt-6 justify-center ${highlight ? '' : 'lode-cta--ghost'}`}>
        {cta} <ArrowRight size={15} />
      </Link>
    </div>
  );
}

/* ---- Security, stated plainly (MARKETING.md §9, §20) -----------------------
 * "Enterprise-grade" is a banned phrase because it means nothing and Aurora
 * has no independent audit yet. This says what's actually true instead. */
function SecurityNote() {
  return (
    <section className="lode-paper px-4 py-16 sm:px-6">
      <div className="mx-auto max-w-2xl">
        <div className="lode-card flex flex-col gap-4 p-7 sm:flex-row sm:items-start sm:p-8">
          <span
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl"
            style={{ background: 'rgba(194,74,64,0.12)', color: 'var(--lode-oxblood)' }}
          >
            <ShieldCheck size={20} />
          </span>
          <div>
            <p className="font-display text-lg font-bold text-[color:var(--lode-ink)]">
              Said plainly, not with a padlock icon
            </p>
            <p className="mt-2 text-sm text-[color:rgba(34,26,20,0.75)]">
              Every table has row-level security. Every paid limit is enforced by the database, not
              only the interface. Payment state is only ever written by a signature-verified
              webhook — your browser is never trusted to say what you paid for. There's a test
              suite whose only job is proving one account can't read another account's data.
            </p>
            <p className="mt-2 text-sm text-[color:rgba(34,26,20,0.75)]">
              What's not true yet: no independent security audit. It's scoped and budgeted, and
              it's the next thing we're paying for — ahead of any advertising.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---- Maker's note ---------------------------------------------------------
 * Aurora is new, so there's no wall of five-star customer quotes to show — and
 * inventing them would be exactly the hype this brand rejects (see the anti-guru
 * voice in DESIGN-GUIDELINES §8 and MARKETING.md §20). Instead: one honest note
 * from the person who built it, and a candid line about where the product
 * stands. */
function MakersNote() {
  return (
    <section className="lode-paper px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-3xl text-center">
        <p className="lode-eyebrow text-[color:var(--lode-oxblood-deep)]">A note from the maker</p>
        <blockquote className="mt-5 font-display text-2xl font-semibold leading-snug text-[color:var(--lode-ink)] sm:text-3xl">
          "I built Aurora because my notes, my boards, and my whiteboard lived in three
          different apps that didn't agree with each other. I wanted one calm home for all of
          it — honest about what it is, and free to start."
        </blockquote>
        <figcaption className="mt-5 font-mono text-xs uppercase tracking-wider text-[color:rgba(34,26,20,0.7)]">
          J. Jai Akash · builder of Aurora
        </figcaption>
        <p className="mx-auto mt-8 max-w-xl text-sm text-[color:rgba(34,26,20,0.7)]">
          Aurora is new, so you won't find a wall of testimonials here yet — we'd rather show
          you the product than quote strangers. Every feature above works today. Try it free and
          judge for yourself.
        </p>
      </div>
    </section>
  );
}

/* ---- Final CTA + footer --------------------------------------------------- */
function FinalCta() {
  return (
    <section className="lode-paper px-4 py-24 text-center sm:px-6">
      <div className="lode-glow mx-auto mb-6 w-fit">
        <img src={MARK} alt="" className="h-12 w-12" />
      </div>
      <h2 className="mx-auto max-w-2xl font-display text-3xl font-black text-[color:var(--lode-ink)] sm:text-5xl">
        Everything you make, <span className="lode-gilt">in one place.</span>
      </h2>
      <p className="mx-auto mt-4 max-w-md text-[color:rgba(34,26,20,0.72)]">
        One calm, beautiful home for your projects, notes and ideas. Free to start, on every device.
      </p>
      <Link to="/signup" className="lode-cta mt-8 text-base">
        Start free <ArrowRight size={17} />
      </Link>
    </section>
  );
}

function Footer() {
  return (
    <footer className="lode-night border-t border-[rgba(255,245,225,0.08)] px-4 py-10 sm:px-6">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 text-sm text-[rgba(236,228,214,0.6)] sm:flex-row">
        <div className="flex items-center gap-2">
          <img src={MARK} alt="" className="h-6 w-6" />
          <span className="font-display font-semibold text-[color:var(--lode-parchment)]">Aurora</span>
          <span className="text-[rgba(236,228,214,0.72)]">· a Nvexis product</span>
        </div>
        <nav className="flex flex-wrap items-center justify-center gap-5">
          <a href="#pricing" className="hover:text-[color:var(--lode-parchment)]">Pricing</a>
          <Link to="/terms" className="hover:text-[color:var(--lode-parchment)]">Terms</Link>
          <Link to="/privacy" className="hover:text-[color:var(--lode-parchment)]">Privacy</Link>
          <a href={`mailto:${ENTERPRISE_CONTACT_EMAIL}`} className="hover:text-[color:var(--lode-parchment)]">Contact</a>
          <Link to="/login" className="hover:text-[color:var(--lode-parchment)]">Sign in</Link>
        </nav>
        <p className="font-mono text-xs text-[rgba(236,228,214,0.72)]">Made by J. Jai Akash</p>
      </div>
    </footer>
  );
}
