import type { ReactNode } from 'react';
import {
  LayoutGrid,
  ListTodo,
  CalendarDays,
  Library,
  Bell,
  Moon,
  MousePointer2,
  Pen,
  Type as TypeIcon,
  Eraser,
  Plus,
  Layers,
} from 'lucide-react';

/**
 * Faux Aurora app screens for the marketing site — HTML stand-ins styled to match
 * the real app (parchment sidebar, dark workspace, oxblood accent, Fraunces
 * headings) with demo content only (never real user data). Drop real PNGs into
 * public/shots/ to replace these.
 */

const OX = '#c24a40';
const OXD = '#7a2a26';
const GOLD = '#d8b455';
const INK = '#181210';
const INK2 = '#211917';
const PAPER = '#ece4d6';
const BONE = '#e7dcc9';

const NAV = [
  ['Boards', LayoutGrid],
  ['To-Do', ListTodo],
  ['Calendar', CalendarDays],
  ['Library', Library],
] as const;

/** The app shell: parchment sidebar + dark top bar + dark workspace. */
function AppFrame({ active, children }: { active: string; children: ReactNode }) {
  return (
    <div className="lode-window overflow-hidden" style={{ background: INK }}>
      <div className="lode-titlebar">
        <span className="lode-dot" style={{ background: '#e0605a' }} />
        <span className="lode-dot" style={{ background: '#e6b13e' }} />
        <span className="lode-dot" style={{ background: '#5aa06a' }} />
        <span className="ml-2 font-mono text-[0.62rem] opacity-50">aurora.app</span>
      </div>
      <div className="flex" style={{ minHeight: 268 }}>
        <aside
          className="hidden w-36 shrink-0 flex-col gap-1 p-2 sm:flex"
          style={{ background: PAPER, color: '#4a3f35' }}
        >
          <div className="mb-1 flex items-center gap-1.5 px-1 py-1">
            <span className="grid h-5 w-5 place-items-center rounded-md" style={{ background: OXD }}>
              <span className="text-[8px] text-white">◆</span>
            </span>
            <span className="font-display text-sm font-bold" style={{ color: OXD }}>Aurora</span>
          </div>
          <div className="rounded-md py-1.5 text-center text-[10px] font-semibold text-white" style={{ background: OX }}>
            + New project
          </div>
          {NAV.map(([label, Icon]) => (
            <div
              key={label}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-[11px] font-medium"
              style={active === label ? { background: OX, color: '#fff' } : { color: '#6a5a4c' }}
            >
              <Icon size={12} /> {label}
            </div>
          ))}
        </aside>
        <div className="min-w-0 flex-1" style={{ color: BONE }}>
          <div
            className="flex items-center gap-2 border-b px-3 py-2"
            style={{ borderColor: 'rgba(255,245,225,0.08)' }}
          >
            <div className="flex-1 rounded-lg px-2.5 py-1.5 text-[10px]" style={{ background: INK2, color: '#8a7d6c' }}>
              Search projects, cards, notes…
            </div>
            <Bell size={13} style={{ color: '#8a7d6c' }} />
            <Moon size={13} style={{ color: '#8a7d6c' }} />
            <span className="grid h-5 w-5 place-items-center rounded-full text-[9px] text-white" style={{ background: '#2f6fb0' }}>J</span>
          </div>
          <div className="p-3">{children}</div>
        </div>
      </div>
    </div>
  );
}

const CHIPS = ['Overdue', 'Due this week', 'In review', 'Approved'];

export function BoardMockup() {
  const cols: { name: string; n: number; cards: { t: string; tag?: string; tagC?: string; done?: boolean }[] }[] = [
    { name: 'To do', n: 2, cards: [{ t: 'Write launch announcement', tag: 'Copy', tagC: OX }, { t: 'Finalise pricing page' }] },
    { name: 'In progress', n: 2, cards: [{ t: 'Design the hero section', tag: 'Design', tagC: '#0f766e' }, { t: 'Set up analytics' }] },
    { name: 'Done', n: 1, cards: [{ t: 'Book the launch webinar', done: true }] },
  ];
  return (
    <AppFrame active="Boards">
      <div className="mb-2 flex items-center gap-2">
        <p className="font-display text-lg font-bold" style={{ color: OX }}>Product Launch</p>
        <span className="rounded px-1.5 py-0.5 text-[8px] font-semibold" style={{ background: `${GOLD}33`, color: GOLD }}>Owner</span>
      </div>
      <div className="mb-2 flex gap-2 text-[9px]">
        {['Board', 'Notes', 'Canvas', 'Activity'].map((t, i) => (
          <span key={t} className="rounded-md px-2 py-1" style={i === 0 ? { background: OX, color: '#fff' } : { color: '#8a7d6c' }}>{t}</span>
        ))}
      </div>
      <div className="mb-2 flex flex-wrap gap-1">
        {CHIPS.map((c) => (
          <span key={c} className="rounded-full border px-1.5 py-0.5 text-[8px]" style={{ borderColor: 'rgba(255,245,225,0.15)', color: '#9a8d7c' }}>{c}</span>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {cols.map((col) => (
          <div key={col.name} className="rounded-lg p-1.5" style={{ background: 'rgba(255,245,225,0.03)' }}>
            <p className="mb-1.5 flex justify-between px-1 text-[9px] font-semibold uppercase tracking-wide" style={{ color: '#8a7d6c' }}>
              {col.name} <span>{col.n}</span>
            </p>
            <div className="flex flex-col gap-1.5">
              {col.cards.map((c) => (
                <div key={c.t} className="rounded-md p-1.5" style={{ background: INK2, border: '1px solid rgba(255,245,225,0.06)' }}>
                  <p className="text-[9.5px] leading-snug" style={{ color: BONE }}>{c.t}</p>
                  {c.tag && <span className="mt-1 inline-block rounded px-1 py-0.5 text-[7.5px] font-semibold" style={{ background: `${c.tagC}33`, color: c.tagC }}>{c.tag}</span>}
                  {c.done && <span className="mt-1 block text-[8px]" style={{ color: '#5aa06a' }}>✓ Done</span>}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </AppFrame>
  );
}

export function EditorMockup() {
  return (
    <AppFrame active="Library">
      <div className="mb-1.5 flex items-center justify-between">
        <p className="font-display text-base font-bold" style={{ color: BONE }}>Launch plan ✦</p>
        <span className="text-[9px]" style={{ color: '#5aa06a' }}>✓ Saved</span>
      </div>
      <div className="space-y-1.5 text-[10px] leading-relaxed" style={{ color: BONE }}>
        <p>
          A single doc for the rollout — with{' '}
          <span style={{ background: `${GOLD}55`, borderRadius: 2, padding: '0 2px', color: INK }}>highlights</span>,{' '}
          <span style={{ color: '#e07a54' }}>colour</span>, and{' '}
          <span style={{ background: `${OX}44`, borderRadius: 2, padding: '0 2px' }}>blocks</span>.
        </p>
        <div className="space-y-1">
          {[['Ship the block editor', true], ['Record the launch video', false], ['Email the beta list', false]].map(([t, done]) => (
            <label key={t as string} className="flex items-center gap-1.5">
              <span className="grid h-3 w-3 place-items-center rounded-[2px]" style={done ? { background: OX, color: '#fff', fontSize: 7 } : { border: '1px solid rgba(255,245,225,0.3)' }}>{done ? '✓' : ''}</span>
              <span style={done ? { textDecoration: 'line-through', opacity: 0.55 } : undefined}>{t as string}</span>
            </label>
          ))}
        </div>
        <div className="rounded-md px-2 py-1" style={{ border: '1px solid rgba(255,245,225,0.1)' }}>▸ Toggle: open questions</div>
        <div className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[8px]" style={{ background: 'rgba(255,245,225,0.05)', color: '#9a8d7c' }}>
          <span style={{ color: GOLD }}>/</span> heading · list · toggle · code · emoji…
        </div>
      </div>
    </AppFrame>
  );
}

export function CanvasMockup() {
  const tools = [MousePointer2, Pen, TypeIcon, Eraser, Plus, Layers];
  return (
    <AppFrame active="Library">
      <div className="mb-1.5 flex items-center gap-1.5 rounded-lg px-1.5 py-1" style={{ background: INK2, width: 'fit-content' }}>
        {tools.map((Ico, i) => (
          <span key={i} className="grid h-5 w-5 place-items-center rounded" style={i === 1 ? { background: OX, color: '#fff' } : { color: '#9a8d7c' }}>
            <Ico size={11} />
          </span>
        ))}
        <span className="ml-1 rounded px-1.5 text-[8px]" style={{ background: 'rgba(255,245,225,0.06)', color: '#9a8d7c' }}>Ruled ▾</span>
      </div>
      <div className="relative overflow-hidden rounded-lg" style={{ height: 150, background: '#171210' }}>
        <svg viewBox="0 0 320 150" className="absolute inset-0 h-full w-full">
          <defs>
            <pattern id="mk-dots" width="16" height="16" patternUnits="userSpaceOnUse">
              <circle cx="1.2" cy="1.2" r="1" fill="rgba(255,245,225,0.08)" />
            </pattern>
          </defs>
          <rect width="320" height="150" fill="url(#mk-dots)" />
          <path d="M22 104 q28 -54 60 -18 t64 -6 t50 -30" fill="none" stroke={OX} strokeWidth="3" strokeLinecap="round" />
          <path d="M36 128 h108" stroke={GOLD} strokeWidth="8" strokeLinecap="round" opacity="0.5" />
          <rect x="176" y="28" width="118" height="52" rx="7" fill="rgba(216,180,85,0.1)" stroke="rgba(216,180,85,0.45)" />
          <text x="187" y="48" fill={BONE} fontSize="9" fontFamily="Spectral, serif">Sprint ideas</text>
          <text x="187" y="63" fill="#a89a86" fontSize="8" fontFamily="Spectral, serif">▶ demo video embed</text>
        </svg>
        <div className="absolute left-[54%] top-[62%] flex items-center gap-1">
          <span style={{ color: '#5aa0d0', fontSize: 10 }}>▲</span>
          <span className="rounded px-1 py-0.5 text-[7px] text-white" style={{ background: '#5aa0d0' }}>Maya</span>
        </div>
        <div className="absolute bottom-1.5 right-1.5 rounded border" style={{ width: 46, height: 32, borderColor: OX, background: 'rgba(0,0,0,0.3)' }} />
      </div>
    </AppFrame>
  );
}

export function CalendarMockup() {
  const chips = [{ d: 2, t: 'Kickoff', c: OX }, { d: 5, t: 'Design due', c: GOLD }, { d: 6, t: 'Standup', c: '#5aa06a' }, { d: 9, t: 'Launch', c: OX }];
  return (
    <AppFrame active="Calendar">
      <p className="mb-2 font-display text-sm font-bold" style={{ color: OX }}>July</p>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: 14 }).map((_, i) => {
          const chip = chips.find((c) => c.d === i);
          return (
            <div key={i} className="rounded" style={{ height: 34, background: 'rgba(255,245,225,0.03)', border: '1px solid rgba(255,245,225,0.05)', padding: 2 }}>
              <span className="text-[7px]" style={{ color: '#8a7d6c' }}>{i + 1}</span>
              {chip && <span className="mt-0.5 block truncate rounded px-1 text-[7px] text-white" style={{ background: chip.c }}>{chip.t}</span>}
            </div>
          );
        })}
      </div>
    </AppFrame>
  );
}

export function PaletteMockup() {
  const rows = ['Boards', 'Library', 'Calendar', 'To-Do'];
  return (
    <AppFrame active="Boards">
      <div className="relative">
        <div className="opacity-30">
          <div className="grid grid-cols-3 gap-1.5">
            {[0, 1, 2].map((i) => <div key={i} className="rounded" style={{ height: 70, background: INK2 }} />)}
          </div>
        </div>
        <div className="absolute left-1/2 top-1 w-52 -translate-x-1/2 overflow-hidden rounded-lg" style={{ background: '#241b17', border: '1px solid rgba(255,245,225,0.12)' }}>
          <div className="border-b px-2.5 py-1.5 font-mono text-[9px]" style={{ borderColor: 'rgba(255,245,225,0.08)', color: BONE }}>
            <span style={{ color: GOLD }}>⌘K</span> &nbsp;Search destinations…
          </div>
          <div className="p-1">
            {rows.map((r, i) => (
              <div key={r} className="flex items-center gap-1.5 rounded px-1.5 py-1 text-[9px]" style={{ background: i === 0 ? 'rgba(216,180,85,0.12)' : 'transparent', color: BONE }}>
                <span className="grid h-3.5 w-3.5 place-items-center rounded" style={{ background: `${OX}33`, color: OX, fontSize: 8 }}>›</span> {r}
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppFrame>
  );
}
