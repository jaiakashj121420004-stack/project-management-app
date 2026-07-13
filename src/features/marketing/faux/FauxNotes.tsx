import { FileText } from 'lucide-react';
import { GlassPanel } from '@/components/glass/GlassPanel';
import { accentVars } from '@/lib/accents';

/**
 * A faux markdown notes editor mirroring the per-project notes feature: a glass
 * panel with a titled header and a rendered markdown body (headings, a list, a
 * checkbox, and inline emphasis) so the preview shows rich docs living beside
 * the board. Purely static markup — no editor logic.
 */
export function FauxNotes() {
  return (
    <GlassPanel strong glow accent="galaxy" className="p-5 sm:p-6" style={accentVars('galaxy')}>
      <div className="mb-4 flex items-center gap-2.5">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-[linear-gradient(135deg,var(--accent-from),var(--accent-to))] text-[var(--accent-fg)] shadow-[0_8px_18px_-8px_var(--accent-glow)]">
          <FileText size={17} />
        </span>
        <div>
          <h3 className="font-display text-base font-semibold text-fg">Launch plan</h3>
          <p className="text-xs text-fg-subtle">Project notes · Markdown</p>
        </div>
      </div>

      <div className="space-y-3 rounded-2xl border border-[var(--hairline)] bg-[var(--field-bg)] p-4">
        <h4 className="font-display text-base font-semibold text-fg">## Goals</h4>
        <p className="text-sm leading-relaxed text-fg-muted">
          Ship the public preview by <span className="font-semibold text-fg">June 30</span> with
          boards, calendar and reminders working end-to-end.
        </p>

        <h4 className="font-display text-sm font-semibold text-fg">### Checklist</h4>
        <ul className="space-y-1.5 text-sm text-fg-muted">
          <li className="flex items-start gap-2">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent-from)]" />
            Finalize pricing copy
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent-from)]" />
            Record the demo walkthrough
          </li>
          <li className="flex items-center gap-2 text-fg-subtle">
            <span className="grid h-4 w-4 shrink-0 place-items-center rounded border border-[var(--glass-border)] text-success">
              ✓
            </span>
            <span className="line-through">Set up the waitlist form</span>
          </li>
        </ul>

        <p className="rounded-lg border-l-2 border-[var(--accent-from)] bg-[var(--glass-fill)] py-2 pl-3 text-sm italic text-fg-muted">
          Keep the onboarding under 60 seconds.
        </p>
      </div>
    </GlassPanel>
  );
}
