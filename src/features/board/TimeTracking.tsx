import { useEffect, useState } from 'react';
import { Clock, Play, Square } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { GradientButton } from '@/components/buttons/GradientButton';
import { track } from '@/lib/analytics';
import type { TimeEntry } from '@/types/database';
import {
  entrySeconds,
  formatHoursMinutes,
  formatHoursMinutesSeconds,
  runningEntryFor,
  totalSeconds,
} from './timeTracking';
import { useStartTimeEntry, useStopTimeEntry } from './useCardExtras';

interface TimeTrackingProps {
  projectId: string;
  cardId: string;
  entries: TimeEntry[];
}

/**
 * The "Time" section inside a card (v1 — plan.md §5, IMPROVEMENT-PLAN-2026-08.md
 * Task 16): a start/stop button with a live-ticking elapsed time while running,
 * and the card's running total (every entry, formatted h:mm). Mirrors
 * Checklist's placement/styling and useCardExtras' optimistic-cache pattern.
 * Starting a timer here stops any OTHER timer the signed-in user has running —
 * one active entry per user at a time, whole-account, not just per card.
 * Deliberately out of scope for v1: billable rates, invoicing, timesheet
 * reports/exports, and tracking on to-do items (memory.md).
 */
export function TimeTracking({ projectId, cardId, entries }: TimeTrackingProps) {
  const { user } = useAuth();
  const start = useStartTimeEntry(projectId);
  const stop = useStopTimeEntry(projectId);
  const [now, setNow] = useState(() => new Date());

  const running = user ? runningEntryFor(entries, user.id, cardId) : undefined;

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

  return (
    <section aria-label="Time tracking" className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-fg">
          <Clock size={16} aria-hidden /> Time
        </h3>
        {total > 0 && (
          <span className="font-mono text-xs font-medium text-fg-muted">
            {formatHoursMinutes(total)}
          </span>
        )}
      </div>

      <GradientButton
        type="button"
        size="sm"
        variant={running ? 'secondary' : 'primary'}
        leftIcon={running ? <Square size={14} /> : <Play size={14} />}
        onClick={handleToggle}
        isLoading={running ? stop.isPending : start.isPending}
        disabled={!user}
        className="self-start font-mono tabular-nums"
      >
        {running ? formatHoursMinutesSeconds(entrySeconds(running, now)) : 'Start timer'}
      </GradientButton>
    </section>
  );
}
