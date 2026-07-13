import { GlassPanel } from '@/components/glass/GlassPanel';
import { accentVars } from '@/lib/accents';

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/** Event chips dropped onto specific day numbers in the faux month grid. */
const EVENTS: Record<number, { label: string; color: string }[]> = {
  9: [{ label: 'Design review', color: '#8B5CF6' }],
  14: [{ label: 'Launch', color: '#06B6D4' }],
  15: [{ label: 'Standup', color: '#10B981' }],
  21: [{ label: 'Retro', color: '#EC4899' }],
  22: [{ label: 'Ship v2', color: '#F59E0B' }],
};

/**
 * A faux month calendar mirroring the app's calendar view: a 7-column grid of
 * day cells on a glass panel, with a couple of colored event chips so the
 * preview shows scheduling at a glance. The month starts on a Wednesday for a
 * natural-looking layout; nothing here is date-aware (it's illustrative).
 */
export function FauxCalendar() {
  // Leading blanks so day 1 lands mid-week, then days 1..31.
  const leading = 2;
  const cells = Array.from({ length: 35 }, (_, i) => {
    const day = i - leading + 1;
    return day >= 1 && day <= 31 ? day : null;
  });

  return (
    <GlassPanel strong glow accent="lagoon" className="p-5" style={accentVars('lagoon')}>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-display text-base font-semibold text-fg">June 2026</h3>
        <span className="rounded-full bg-[var(--glass-fill)] px-2.5 py-1 text-xs font-medium text-fg-muted">
          Month
        </span>
      </div>

      <div className="grid grid-cols-7 gap-1.5 text-center">
        {WEEKDAYS.map((day, i) => (
          <div key={i} className="pb-1 text-[0.65rem] font-semibold uppercase text-fg-subtle">
            {day}
          </div>
        ))}

        {cells.map((day, i) => (
          <div
            key={i}
            className="min-h-[3rem] rounded-lg border border-[var(--hairline)] bg-[var(--glass-fill)] p-1 text-left"
          >
            {day && (
              <>
                <span className="text-[0.7rem] font-medium text-fg-muted">{day}</span>
                <div className="mt-0.5 flex flex-col gap-0.5">
                  {(EVENTS[day] ?? []).map((event) => (
                    <span
                      key={event.label}
                      className="truncate rounded px-1 py-px text-[0.6rem] font-medium text-[var(--accent-fg)]"
                      style={{ backgroundColor: event.color }}
                    >
                      {event.label}
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </GlassPanel>
  );
}
