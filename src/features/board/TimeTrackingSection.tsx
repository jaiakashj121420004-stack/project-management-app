import { useEffect, useState } from 'react';
import { Clock, Pause, Play, RotateCcw } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { GradientButton } from '@/components/buttons/GradientButton';
import { track } from '@/lib/analytics';
import type { TimeEntry } from '@/types/database';
import {
  formatHoursMinutes,
  formatHoursMinutesSeconds,
  runningEntryFor,
  totalSeconds,
} from './timeTracking';
import { useDeleteTimeEntries, useStartTimeEntry, useStopTimeEntry } from './useCardExtras';

interface TimeTrackingProps {
  projectId: string;
  cardId: string;
  entries: TimeEntry[];
}

/**
 * The "Time" section inside a card (v1 — plan.md §5, IMPROVEMENT-PLAN-2026-08.md
 * Task 16). Reads as Start / Pause / Reset, not Start / Stop: the toggle button
 * pauses and resumes the SAME running total (the underlying start/stop mutation
 * pair already preserves it across entries — only the copy/icon changed here),
 * and while running the button shows the card's cumulative total ticking live,
 * not just the current entry's own elapsed time, so there's never mental math
 * across past sessions. Reset is a separate, explicitly-confirmed action that
 * clears tracked time (see useDeleteTimeEntries's doc comment for why it's
 * scoped to the current user's own entries only).
 * Mirrors Checklist's placement/styling and useCardExtras' optimistic-cache
 * pattern. Starting a timer here pauses any OTHER timer the signed-in user has
 * running — one active entry per user at a time, whole-account, not just per
 * card. Deliberately out of scope for v1: billable rates, invoicing, timesheet
 * reports/exports, and tracking on to-do items (memory.md).
 */
export function TimeTracking({ projectId, cardId, entries }: TimeTrackingProps) {
  const { user } = useAuth();
  const start = useStartTimeEntry(projectId);
  const stop = useStopTimeEntry(projectId);
  const reset = useDeleteTimeEntries(projectId);
  const [now, setNow] = useState(() => new Date());
  const [confirmingReset, setConfirmingReset] = useState(false);

  const running = user ? runningEntryFor(entries, user.id, cardId) : undefined;
  const ownEntries = user ? entries.filter((entry) => entry.user_id === user.id) : [];

  // Tick once a second only while this card's timer is actually running — no
  // background interval otherwise.
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, [running]);

  const total = totalSeconds(entries, now);

  function handleToggle() {
    if (!user) return;
    if (running) {
      stop.mutate({ id: running.id });
      track('time_entry_stopped', { project_id: projectId });
    } else {
      start.mutate({ cardId, userId: user.id, tempId: crypto.randomUUID() });
      track('time_entry_started', { project_id: projectId });
    }
  }

  function handleReset() {
    if (!user) return;
    reset.mutate({ cardId, userId: user.id });
    setConfirmingReset(false);
  }

  const showReset = !running && ownEntries.length > 0;

  return (
    <section aria-label="Time tracking" className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-fg">
          <Clock size={16} aria-hidden /> Time
        </h3>
        {total > 0 && !running && (
          <span className="font-mono text-xs font-medium text-fg-muted">
            {formatHoursMinutes(total)}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <GradientButton
          type="button"
          size="sm"
          variant={running ? 'secondary' : 'primary'}
          leftIcon={running ? <Pause size={14} /> : <Play size={14} />}
          onClick={handleToggle}
          isLoading={running ? stop.isPending : start.isPending}
          disabled={!user}
          className="self-start font-mono tabular-nums"
        >
          {running ? formatHoursMinutesSeconds(total) : total > 0 ? 'Resume timer' : 'Start timer'}
        </GradientButton>

        {showReset && (
          <button
            type="button"
            aria-label="Reset tracked time"
            onClick={() => setConfirmingReset((open) => !open)}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-fg-subtle transition-colors hover:bg-danger/10 hover:text-danger"
          >
            <RotateCcw size={16} />
          </button>
        )}
      </div>

      {confirmingReset && showReset && (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-fg-muted">
          <span>Clear your tracked time on this card? This can&apos;t be undone.</span>
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() => setConfirmingReset(false)}
              className="rounded-lg px-2 py-1 text-xs font-medium text-fg-muted hover:bg-[var(--glass-fill)]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="rounded-lg bg-danger/20 px-2 py-1 text-xs font-semibold text-danger hover:bg-danger/30"
            >
              Clear
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
