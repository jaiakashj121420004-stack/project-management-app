import type { ReactNode } from 'react';
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/cn';
import { GradientButton } from '@/components/buttons/GradientButton';
import type { Project } from '@/types/database';
import type { CalendarView } from './dates';

interface CalendarToolbarProps {
  view: CalendarView;
  onViewChange: (view: CalendarView) => void;
  /** `'all'` or a project id. */
  scope: string;
  onScopeChange: (scope: string) => void;
  projects: Project[];
  periodLabel: string;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}

/** Calendar header: title + period, a month/week toggle, period navigation, and
 *  the project scope selector. Stacks gracefully on small screens. */
export function CalendarToolbar({
  view,
  onViewChange,
  scope,
  onScopeChange,
  projects,
  periodLabel,
  onPrev,
  onNext,
  onToday,
}: CalendarToolbarProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[linear-gradient(135deg,var(--accent-from),var(--accent-to))] text-white shadow-[0_12px_26px_-12px_var(--accent-glow)]">
            <CalendarDays size={22} />
          </span>
          <div>
            <h1 className="gradient-text font-display text-headline font-bold leading-none">Calendar</h1>
            <p className="mt-1 text-sm text-fg-muted">{periodLabel}</p>
          </div>
        </div>

        <Segmented value={view} onChange={onViewChange} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <IconButton label="Previous period" onClick={onPrev}>
            <ChevronLeft size={18} />
          </IconButton>
          <GradientButton variant="secondary" size="sm" onClick={onToday}>
            Today
          </GradientButton>
          <IconButton label="Next period" onClick={onNext}>
            <ChevronRight size={18} />
          </IconButton>
        </div>

        <div className="ml-auto">
          <label className="relative inline-flex items-center">
            <span className="sr-only">Filter by project</span>
            <select
              value={scope}
              onChange={(event) => onScopeChange(event.target.value)}
              className="h-9 appearance-none rounded-xl border border-[var(--glass-border)] bg-[var(--field-bg)] pl-3.5 pr-9 text-sm font-medium text-fg backdrop-blur-sm transition-colors focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--accent-from)]"
            >
              <option value="all">All projects</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
            <ChevronDown
              size={16}
              aria-hidden
              className="pointer-events-none absolute right-3 text-fg-subtle"
            />
          </label>
        </div>
      </div>
    </div>
  );
}

function Segmented({ value, onChange }: { value: CalendarView; onChange: (view: CalendarView) => void }) {
  return (
    <div className="glass inline-flex rounded-2xl p-1">
      {(['month', 'week'] as const).map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={value === option}
          onClick={() => onChange(option)}
          className={cn(
            'rounded-xl px-3.5 py-1.5 text-sm font-medium capitalize transition-colors',
            value === option
              ? 'bg-[linear-gradient(135deg,var(--accent-from),var(--accent-to))] text-white shadow-[0_8px_18px_-10px_var(--accent-glow)]'
              : 'text-fg-muted hover:text-fg',
          )}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="grid h-9 w-9 place-items-center rounded-xl text-fg-muted transition-colors hover:bg-[var(--glass-fill)] hover:text-fg"
    >
      {children}
    </button>
  );
}
