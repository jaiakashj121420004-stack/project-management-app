import type { ReactNode } from 'react';

/**
 * Faux app screens for the Lodestar marketing site — styled stand-ins for real
 * screenshots (which can't be captured at build time). Pure presentational; each
 * lives inside a `.lode-window` chrome so it reads like a captured app view.
 */

function Window({
  children,
  paper = false,
  title,
  className = '',
}: {
  children: ReactNode;
  paper?: boolean;
  title?: string;
  className?: string;
}) {
  return (
    <div className={`lode-window ${paper ? 'lode-window--paper' : ''} ${className}`}>
      <div className="lode-titlebar">
        <span className="lode-dot" style={{ background: '#e0605a' }} />
        <span className="lode-dot" style={{ background: '#e6b13e' }} />
        <span className="lode-dot" style={{ background: '#5aa06a' }} />
        {title && (
          <span className="ml-2 font-mono text-[0.68rem] uppercase tracking-widest opacity-60">
            {title}
          </span>
        )}
      </div>
      <div className="p-3 sm:p-4">{children}</div>
    </div>
  );
}

const OX = '#c24a40';
const GOLD = '#d8b455';

/** Kanban board with columns + cards. */
export function BoardMockup() {
  const cols: { name: string; cards: { t: string; tag?: string; done?: boolean }[] }[] = [
    { name: 'To do', cards: [{ t: 'Design the almanac cover', tag: 'Design' }, { t: 'Draft Q3 goals' }] },
    { name: 'In progress', cards: [{ t: 'Build the Kanban board', tag: 'Dev' }, { t: 'User interviews' }] },
    { name: 'Done', cards: [{ t: 'Set up the workspace', done: true }] },
  ];
  return (
    <Window title="Boards" paper>
      <div className="grid grid-cols-3 gap-2">
        {cols.map((col) => (
          <div key={col.name} className="rounded-xl bg-black/[0.03] p-2">
            <p className="mb-2 px-1 text-[0.7rem] font-semibold uppercase tracking-wide opacity-60">
              {col.name}
            </p>
            <div className="flex flex-col gap-1.5">
              {col.cards.map((c) => (
                <div key={c.t} className="rounded-lg border border-black/5 bg-white/70 p-2 shadow-sm">
                  <p className="text-[0.74rem] leading-snug">{c.t}</p>
                  {c.tag && (
                    <span
                      className="mt-1 inline-block rounded px-1.5 py-0.5 text-[0.6rem] font-semibold"
                      style={{ background: `${OX}22`, color: OX }}
                    >
                      {c.tag}
                    </span>
                  )}
                  {c.done && <span className="mt-1 block text-[0.6rem] text-green-700">✓ Completed</span>}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Window>
  );
}

/** Notion-style block editor: heading, colours, task list, toggle, slash hint. */
export function EditorMockup() {
  return (
    <Window title="Block editor">
      <div className="space-y-2 text-[0.8rem] leading-relaxed" style={{ color: '#e7dcc9' }}>
        <p className="font-display text-lg font-bold" style={{ color: '#f0e6d4' }}>
          Launch plan ✦
        </p>
        <p>
          A single doc for the whole rollout —{' '}
          <span style={{ background: `${GOLD}55`, borderRadius: 3, padding: '0 3px' }}>highlights</span>,{' '}
          <span style={{ color: GOLD }}>colour</span>, and blocks.
        </p>
        <div className="space-y-1">
          <label className="flex items-center gap-2">
            <span className="grid h-3.5 w-3.5 place-items-center rounded-[3px]" style={{ background: OX, color: '#fff', fontSize: 9 }}>✓</span>
            <span className="line-through opacity-60">Ship the block editor</span>
          </label>
          <label className="flex items-center gap-2">
            <span className="h-3.5 w-3.5 rounded-[3px] border border-white/30" />
            <span>Record the launch video</span>
          </label>
        </div>
        <div className="rounded-lg border border-white/10 px-2 py-1.5">
          <span className="opacity-70">▸ Toggle: open questions</span>
        </div>
        <div className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-1 font-mono text-[0.68rem] opacity-70">
          <span style={{ color: GOLD }}>/</span> type for headings, lists, toggles…
        </div>
      </div>
    </Window>
  );
}

/** Infinite canvas with a freehand stroke, a highlighter, a note, a remote cursor. */
export function CanvasMockup() {
  return (
    <Window title="Canvas">
      <div className="relative h-44 overflow-hidden rounded-lg" style={{ background: '#171210' }}>
        <svg viewBox="0 0 320 176" className="absolute inset-0 h-full w-full">
          <defs>
            <pattern id="lode-dots" width="18" height="18" patternUnits="userSpaceOnUse">
              <circle cx="1.4" cy="1.4" r="1.1" fill="rgba(255,245,225,0.10)" />
            </pattern>
          </defs>
          <rect width="320" height="176" fill="url(#lode-dots)" />
          <path d="M24 120 q30 -60 66 -20 t70 -6 t54 -34" fill="none" stroke={OX} strokeWidth="3.5" strokeLinecap="round" />
          <path d="M40 150 h120" stroke={GOLD} strokeWidth="9" strokeLinecap="round" opacity="0.5" />
          <rect x="188" y="34" width="104" height="52" rx="8" fill="rgba(216,180,85,0.12)" stroke="rgba(216,180,85,0.5)" />
          <text x="200" y="58" fill="#efe6d4" fontSize="10" fontFamily="Spectral, serif">Brainstorm</text>
          <text x="200" y="74" fill="#c8bca9" fontSize="9" fontFamily="Spectral, serif">ideas live here</text>
        </svg>
        {/* remote collaborator cursor */}
        <div className="absolute left-[58%] top-[64%] flex items-center gap-1">
          <span style={{ color: '#5aa0d0' }}>▲</span>
          <span className="rounded px-1 py-0.5 text-[0.6rem] text-white" style={{ background: '#5aa0d0' }}>Maya</span>
        </div>
      </div>
    </Window>
  );
}

/** Month calendar with a few event chips. */
export function CalendarMockup() {
  const chips = [
    { d: 2, t: 'Kickoff', c: OX },
    { d: 5, t: 'Design due', c: GOLD },
    { d: 6, t: 'Standup', c: '#5aa06a' },
    { d: 9, t: 'Launch', c: OX },
  ];
  return (
    <Window title="Calendar" paper>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: 14 }).map((_, i) => {
          const chip = chips.find((c) => c.d === i);
          return (
            <div key={i} className="h-12 rounded-md border border-black/5 bg-white/60 p-1">
              <span className="text-[0.6rem] opacity-40">{i + 1}</span>
              {chip && (
                <span
                  className="mt-0.5 block truncate rounded px-1 text-[0.58rem] font-medium text-white"
                  style={{ background: chip.c }}
                >
                  {chip.t}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </Window>
  );
}

/** Command palette overlay. */
export function PaletteMockup() {
  const rows = ['Boards', 'Library', 'Calendar', 'To-Do'];
  return (
    <Window title="⌘K">
      <div className="rounded-lg border border-white/10 bg-black/30">
        <div className="border-b border-white/10 px-3 py-2 font-mono text-[0.72rem]" style={{ color: '#e7dcc9' }}>
          <span style={{ color: GOLD }}>⌘K</span> &nbsp;Search destinations…
        </div>
        <div className="p-1.5">
          {rows.map((r, i) => (
            <div
              key={r}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-[0.75rem]"
              style={{ background: i === 0 ? 'rgba(216,180,85,0.12)' : 'transparent', color: '#e7dcc9' }}
            >
              <span className="grid h-5 w-5 place-items-center rounded" style={{ background: `${OX}22`, color: OX }}>›</span>
              {r}
            </div>
          ))}
        </div>
      </div>
    </Window>
  );
}
