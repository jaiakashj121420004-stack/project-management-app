import { CalendarClock, CheckSquare, Square, Flag } from 'lucide-react';
import { GlassPanel } from '@/components/glass/GlassPanel';
import { LabelPill } from '@/features/board/LabelPill';
import { Avatar } from '@/components/Avatar';
import { accentVars } from '@/lib/accents';

const CHECKLIST = [
  { text: 'Audit current sign-up steps', done: true },
  { text: 'Sketch the new flow', done: true },
  { text: 'Build the welcome screen', done: false },
  { text: 'Add progress indicator', done: false },
];

/**
 * A faux card-detail panel mirroring the real card modal: title, label pills,
 * a due-date + priority row, an assignee, and an interactive-looking checklist
 * with a progress bar. Reuses `LabelPill` and `Avatar` so it matches the app.
 */
export function FauxCardDetail() {
  const done = CHECKLIST.filter((item) => item.done).length;
  const pct = Math.round((done / CHECKLIST.length) * 100);

  return (
    <GlassPanel strong glow accent="bloom" className="p-5 sm:p-6" style={accentVars('bloom')}>
      <div className="mb-3 flex flex-wrap gap-2">
        <LabelPill name="Design" color="violet" />
        <LabelPill name="UX" color="pink" />
      </div>

      <h3 className="font-display text-lg font-semibold text-fg">Design the onboarding flow</h3>
      <p className="mt-2 text-sm leading-relaxed text-fg-muted">
        Reduce the steps to first value and make the empty state feel inviting.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-warning/30 bg-warning/10 px-2.5 py-1 text-xs font-medium text-warning">
          <CalendarClock size={13} /> Due in 2 days
        </span>
        <span className="inline-flex items-center gap-1 rounded-full border border-warning/40 bg-warning/15 px-2.5 py-1 text-xs font-semibold text-warning">
          <Flag size={11} /> P3
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--glass-border)] bg-[var(--glass-fill)] px-2 py-1 text-xs font-medium text-fg-muted">
          <Avatar name="Maya Chen" size={18} /> Maya
        </span>
      </div>

      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="inline-flex items-center gap-1.5 font-medium text-fg">
            <CheckSquare size={15} /> Checklist
          </span>
          <span className="text-fg-muted">
            {done}/{CHECKLIST.length}
          </span>
        </div>

        <div className="h-1.5 overflow-hidden rounded-full bg-[var(--glass-fill)]">
          <div
            className="h-full rounded-full bg-[linear-gradient(110deg,var(--accent-from),var(--accent-to))]"
            style={{ width: `${pct}%` }}
          />
        </div>

        <ul className="mt-3 flex flex-col gap-2">
          {CHECKLIST.map((item) => (
            <li key={item.text} className="flex items-center gap-2 text-sm">
              {item.done ? (
                <CheckSquare size={16} className="shrink-0 text-success" />
              ) : (
                <Square size={16} className="shrink-0 text-fg-subtle" />
              )}
              <span className={item.done ? 'text-fg-subtle line-through' : 'text-fg'}>
                {item.text}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </GlassPanel>
  );
}
