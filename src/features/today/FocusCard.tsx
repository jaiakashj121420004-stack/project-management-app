import { Link } from 'react-router-dom';
import { format, startOfToday } from 'date-fns';
import { ArrowRight, Check } from 'lucide-react';
import { GlassPanel } from '@/components/glass/GlassPanel';
import { toDateKey } from '@/features/calendar/dates';
import { useTodos } from '@/features/todos/useTodos';
import { cn } from '@/lib/cn';

const R = 54;
const C = 2 * Math.PI * R;

/** Progress ring: how much of today's to-dos are done. */
function Ring({ done, total }: { done: number; total: number }) {
  const pct = total === 0 ? 0 : done / total;
  return (
    <svg width="132" height="132" viewBox="0 0 132 132" role="img" aria-label={`${done} of ${total} to-dos done today`} className="shrink-0">
      <circle cx="66" cy="66" r={R} fill="none" stroke="rgb(var(--fg) / 0.1)" strokeWidth="13" />
      <circle
        cx="66"
        cy="66"
        r={R}
        fill="none"
        stroke="var(--accent-from)"
        strokeWidth="13"
        strokeLinecap="round"
        strokeDasharray={`${C * pct} ${C}`}
        transform="rotate(-90 66 66)"
        style={{ transition: 'stroke-dasharray .8s cubic-bezier(.2,.8,.2,1)' }}
      />
      <text x="66" y="72" textAnchor="middle" className="fill-[rgb(var(--fg))] font-display text-[30px] font-bold">
        {total === 0 ? '–' : `${done}/${total}`}
      </text>
      <text x="66" y="90" textAnchor="middle" className="fill-[rgb(var(--fg-subtle))] text-[9px] uppercase tracking-[0.14em]">
        done today
      </text>
    </svg>
  );
}

/** "Today's focus": the A3 headline card — ring + the next few to-dos. */
export function FocusCard() {
  const todayKey = toDateKey(startOfToday());
  const { data } = useTodos(todayKey);
  const items = (data?.items ?? []).slice().sort((a, b) => Number(a.is_done) - Number(b.is_done));
  const done = items.filter((i) => i.is_done).length;
  const open = items.length - done;

  return (
    <GlassPanel strong className="flex flex-col items-center gap-5 p-5 sm:flex-row sm:p-6" style={{ borderRadius: '1.75rem' }}>
      <Ring done={done} total={items.length} />
      <div className="min-w-0 flex-1 self-stretch">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-display text-xl font-semibold text-fg">Today&apos;s focus</h2>
          <span className="text-xs uppercase tracking-wider text-fg-subtle">
            {format(new Date(), 'EEE, MMM d')} · {open} left
          </span>
        </div>
        {items.length === 0 ? (
          <p className="mt-3 text-fg-muted">Nothing planned yet. Add a to-do to start your day.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {items.slice(0, 4).map((item) => (
              <li key={item.id} className="flex items-center gap-3 text-[0.95rem]">
                <span
                  className={cn(
                    'grid h-5 w-5 shrink-0 place-items-center rounded-md border',
                    item.is_done
                      ? 'border-transparent bg-[linear-gradient(110deg,var(--accent-from),var(--accent-to))] text-[var(--accent-fg)]'
                      : 'neu-inset',
                  )}
                  aria-hidden
                >
                  {item.is_done && <Check size={13} strokeWidth={3.4} />}
                </span>
                <span className={cn('truncate', item.is_done ? 'text-fg-subtle line-through' : 'text-fg')}>{item.text}</span>
              </li>
            ))}
          </ul>
        )}
        <Link to="/todos" className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--accent-from)] hover:underline">
          Open to-do list <ArrowRight size={15} />
        </Link>
      </div>
    </GlassPanel>
  );
}
