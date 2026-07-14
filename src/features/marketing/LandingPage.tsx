import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Command,
  Palette,
  Search,
  Bell,
  Download,
  WifiOff,
  Map,
  MessagesSquare,
  ShieldCheck,
  ClipboardCheck,
  Sparkles,
  Users,
  type LucideIcon,
} from 'lucide-react';
import {
  BoardMockup,
  EditorMockup,
  CanvasMockup,
  CalendarMockup,
  PaletteMockup,
} from './lodestar/Mockups';
import './lodestar.css';

const MARK = '/brand/nvexis-mark-transparent-800.png';

/**
 * The public landing page — "Lodestar", the celestial front door of Aurora (a
 * Nvexis product line). A starlit hero descends into warm parchment feature
 * sections showcasing every part of the app, on the Nvexis palette + gilt accent.
 * Faux app windows stand in for screenshots (see lodestar/Mockups.tsx).
 */
export function LandingPage() {
  return (
    <div className="lode min-h-dvh bg-[color:var(--lode-night)] font-body antialiased">
      <Nav />
      <Hero />
      <StatBand />
      <Spotlights />
      <FeatureGrid />
      <CollaborationBand />
      <Pricing />
      <Testimonials />
      <FinalCta />
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
          <Link to="/pricing" className="hover:text-[color:var(--lode-parchment)]">Pricing</Link>
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
    <section className="lode-night lode-stars relative px-4 pb-24 pt-16 sm:px-6 sm:pt-24">
      <div className="mx-auto max-w-3xl text-center">
        <div className="lode-glow mx-auto mb-7 w-fit">
          <img src={MARK} alt="Nvexis" className="mx-auto h-16 w-16" />
        </div>
        <p className="lode-eyebrow mb-4 text-[rgba(216,180,85,0.9)]">Your work’s guiding star</p>
        <h1 className="font-display text-4xl font-black leading-[1.05] text-[color:var(--lode-parchment)] sm:text-6xl">
          Every project, note, and idea — <span className="lode-gilt">in one lodestar.</span>
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-lg text-[rgba(236,228,214,0.72)]">
          Aurora is a jaw-dropping workspace: Kanban boards, a Notion-style editor, an infinite
          collaborative canvas, calendar, and to-dos — installable on every device, synced, and
          free to start.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link to="/signup" className="lode-cta text-base">
            Start free <ArrowRight size={17} />
          </Link>
          <Link
            to="/pricing"
            className="rounded-xl border border-[rgba(255,245,225,0.18)] px-5 py-2.5 text-[rgba(236,228,214,0.9)] transition-colors hover:bg-white/5"
          >
            See what’s inside
          </Link>
        </div>
        <p className="mt-4 font-mono text-xs uppercase tracking-widest text-[rgba(236,228,214,0.45)]">
          No credit card · Works on mobile + desktop
        </p>
      </div>

      {/* Flagship montage */}
      <div className="mx-auto mt-14 grid max-w-5xl gap-4 sm:grid-cols-2">
        <div className="sm:mt-8"><BoardMockup /></div>
        <div><EditorMockup /></div>
      </div>
    </section>
  );
}

/* ---- Stat band ------------------------------------------------------------ */
function StatBand() {
  const stats = [
    ['1', 'workspace for your whole life’s work'],
    ['∞', 'canvas + folders, nested however you think'],
    ['2-ink', 'warm, editorial, easy on the eyes'],
    ['0', 'to start — free forever plan'],
  ];
  return (
    <section className="lode-night border-y border-[rgba(255,245,225,0.08)] px-4 py-8 sm:px-6">
      <div className="mx-auto grid max-w-5xl grid-cols-2 gap-6 text-center sm:grid-cols-4">
        {stats.map(([n, label]) => (
          <div key={label}>
            <p className="font-display text-3xl font-black lode-gilt">{n}</p>
            <p className="mt-1 text-xs text-[rgba(236,228,214,0.6)]">{label}</p>
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
        <p className="lode-eyebrow text-[color:var(--lode-gold-deep)]">{eyebrow}</p>
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
        <p className="lode-eyebrow text-[color:var(--lode-gold-deep)]">Everything, in one place</p>
        <h2 className="mt-2 font-display text-3xl font-black text-[color:var(--lode-ink)] sm:text-4xl">
          A whole workspace that finally feels like one thing.
        </h2>
      </div>
      <div className="mx-auto mt-16 flex max-w-5xl flex-col gap-20">
        <Spotlight
          eyebrow="Boards"
          title="Kanban that gets out of your way"
          body="Drag cards across columns, set due dates and priorities, attach checklists and labels. Multiple projects, each its own board."
          points={['Drag-and-drop columns & cards', 'Due dates, priorities, checklists, labels', 'Assignees + a linked calendar']}
          mockup={<BoardMockup />}
        />
        <Spotlight
          reverse
          eyebrow="Library + Editor"
          title="A Notion-style editor, organised like a file explorer"
          body="Standalone notes and canvases live in one nested Library. Write with a real block editor: slash commands, toggles, task lists, custom colours, emoji, drag-to-reorder."
          points={['Infinite folders for notes + canvases', '“/” slash menu, toggles, task lists, colours', 'Full-text search across your Library']}
          mockup={<EditorMockup />}
        />
        <Spotlight
          eyebrow="Canvas · Pro"
          title="An infinite whiteboard that thinks with you"
          body="Pressure-sensitive pen, marker and highlighter, shapes and text, images, audio and video — and live multiplayer cursors so a team can sketch together in real time."
          points={['Freehand ink, media, embeds', 'Live cursors + real-time co-editing', 'Minimap, fit-to-content, page styles']}
          mockup={<CanvasMockup />}
        />
      </div>
    </section>
  );
}

/* ---- Feature grid (covers every remaining feature) ------------------------ */
const GRID: { icon: LucideIcon; title: string; body: string }[] = [
  { icon: CalendarDays, title: 'Calendar', body: 'Month & week views; drag any card to reschedule.' },
  { icon: ClipboardCheck, title: 'Daily to-do planner', body: 'Plan your day, with recurring task templates.' },
  { icon: Command, title: '⌘K command palette', body: 'Jump anywhere in a keystroke.' },
  { icon: Search, title: 'Library search', body: 'Find any note, canvas, or folder instantly.' },
  { icon: Bell, title: 'Reminders', body: 'Email + browser notifications, at custom times.' },
  { icon: Download, title: 'Installable PWA', body: 'Add to your phone & desktop like a native app.' },
  { icon: WifiOff, title: 'Works offline', body: 'Read your work offline; syncs across devices.' },
  { icon: Map, title: 'Canvas minimap', body: 'Overview, fit-to-content, click-to-jump.' },
  { icon: Palette, title: 'Custom colours', body: 'Text, highlight & pen colours everywhere.' },
  { icon: MessagesSquare, title: 'Comments & @mentions', body: 'Discuss on cards; react with emoji.' },
  { icon: Users, title: 'Sharing & roles', body: 'Invite by email as editor or viewer.' },
  { icon: ShieldCheck, title: 'Private by default', body: 'Row-level security guards every row.' },
];

function FeatureGrid() {
  return (
    <section className="lode-paper px-4 pb-20 sm:px-6">
      <div className="mx-auto grid max-w-5xl gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {GRID.map(({ icon: Icon, title, body }) => (
          <div key={title} className="lode-card p-4">
            <span
              className="grid h-9 w-9 place-items-center rounded-xl"
              style={{ background: 'rgba(194,74,64,0.12)', color: 'var(--lode-oxblood)' }}
            >
              <Icon size={18} />
            </span>
            <p className="mt-3 font-display font-semibold text-[color:var(--lode-ink)]">{title}</p>
            <p className="mt-1 text-sm text-[color:rgba(34,26,20,0.68)]">{body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---- Collaboration band (dark) -------------------------------------------- */
function CollaborationBand() {
  return (
    <section id="collaborate" className="lode-night lode-stars px-4 py-20 sm:px-6">
      <div className="mx-auto grid max-w-5xl items-center gap-10 md:grid-cols-2">
        <div>
          <p className="lode-eyebrow text-[rgba(216,180,85,0.9)]">Better together</p>
          <h2 className="mt-2 font-display text-3xl font-black text-[color:var(--lode-parchment)] sm:text-4xl">
            Work with your team, live.
          </h2>
          <p className="mt-3 text-[rgba(236,228,214,0.72)]">
            Invite people to a board, a canvas, or a single note. See who’s here with presence
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
          <CanvasMockup />
          <div className="grid grid-cols-2 gap-4">
            <CalendarMockup />
            <PaletteMockup />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---- Pricing -------------------------------------------------------------- */
function Pricing() {
  const free = ['Unlimited boards, notes & to-dos', 'The full block editor & Library', 'Calendar, reminders, PWA + offline', 'Share notes with collaborators'];
  const pro = ['Everything in Free', 'The infinite Canvas + media', 'Live real-time co-editing', 'Custom timed reminders & more'];
  return (
    <section className="lode-paper px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-3xl text-center">
        <p className="lode-eyebrow text-[color:var(--lode-gold-deep)]">Simple pricing</p>
        <h2 className="mt-2 font-display text-3xl font-black text-[color:var(--lode-ink)] sm:text-4xl">
          Start free. Upgrade when you fly.
        </h2>
      </div>
      <div className="mx-auto mt-10 grid max-w-3xl gap-4 sm:grid-cols-2">
        <PlanCard name="Free" price="$0" tagline="For getting organised" points={free} cta="Start free" to="/signup" />
        <PlanCard name="Pro" price="$8" period="/mo" tagline="For teams & big ideas" points={pro} cta="Go Pro" to="/signup" highlight />
      </div>
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
        <span className="lode-chip absolute -top-3 left-6 bg-[#fdfaf4]">
          <Sparkles size={12} /> Most loved
        </span>
      )}
      <p className="font-display text-lg font-bold text-[color:var(--lode-ink)]">{name}</p>
      <p className="mt-1 text-sm text-[color:rgba(34,26,20,0.6)]">{tagline}</p>
      <p className="mt-4 font-display text-4xl font-black text-[color:var(--lode-ink)]">
        {price}<span className="text-base font-medium text-[color:rgba(34,26,20,0.5)]">{period}</span>
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

/* ---- Testimonials --------------------------------------------------------- */
function Testimonials() {
  const quotes = [
    ['“It replaced three apps. My notes, my board, and my whiteboard finally live together.”', 'Priya · Product designer'],
    ['“The canvas co-editing feels like magic — we brainstorm live from different cities.”', 'Marco · Startup founder'],
    ['“Beautiful and fast. The block editor is the first one I actually enjoy writing in.”', 'Dana · Writer'],
  ];
  return (
    <section className="lode-night px-4 py-20 sm:px-6">
      <div className="mx-auto grid max-w-5xl gap-4 md:grid-cols-3">
        {quotes.map(([q, who]) => (
          <figure key={who} className="rounded-2xl border border-[rgba(255,245,225,0.1)] bg-white/[0.03] p-6">
            <blockquote className="text-[rgba(236,228,214,0.9)]">{q}</blockquote>
            <figcaption className="mt-4 font-mono text-xs uppercase tracking-wider text-[rgba(216,180,85,0.8)]">
              {who}
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

/* ---- Final CTA + footer --------------------------------------------------- */
function FinalCta() {
  return (
    <section className="lode-night lode-stars px-4 py-24 text-center sm:px-6">
      <div className="lode-glow mx-auto mb-6 w-fit">
        <img src={MARK} alt="" className="h-12 w-12" />
      </div>
      <h2 className="mx-auto max-w-2xl font-display text-3xl font-black text-[color:var(--lode-parchment)] sm:text-5xl">
        Find your <span className="lode-gilt">lodestar.</span>
      </h2>
      <p className="mx-auto mt-4 max-w-md text-[rgba(236,228,214,0.72)]">
        One calm, beautiful home for everything you’re making. Free to start, on every device.
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
          <span className="opacity-50">· a Nvexis product</span>
        </div>
        <nav className="flex flex-wrap items-center justify-center gap-5">
          <Link to="/pricing" className="hover:text-[color:var(--lode-parchment)]">Pricing</Link>
          <Link to="/terms" className="hover:text-[color:var(--lode-parchment)]">Terms</Link>
          <Link to="/privacy" className="hover:text-[color:var(--lode-parchment)]">Privacy</Link>
          <Link to="/login" className="hover:text-[color:var(--lode-parchment)]">Sign in</Link>
        </nav>
        <p className="font-mono text-xs opacity-50">Made by J. Jai Akash</p>
      </div>
    </footer>
  );
}
