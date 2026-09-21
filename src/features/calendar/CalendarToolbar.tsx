import { useState, type ReactNode } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/cn';
import { GradientButton } from '@/components/buttons/GradientButton';
import { accentVars, type AccentName } from '@/lib/accents';
import type { Card, Project } from '@/types/database';
import { CalendarProjectFilter } from './CalendarProjectFilter';
import { CalendarSearch } from './CalendarSearch';
import { MiniMonthPicker } from './MiniMonthPicker';
import type { CalendarView } from './dates';

interface CalendarToolbarProps {
  view: CalendarView;
  onViewChange: (view: CalendarView) => void;
  projects: Project[];
  visibleProjectIds: Set<string>;
  onToggleProject: (id: string) => void;
  onShowAllProjects: () => void;
  onShowOnlyProject: (id: string) => void;
  periodLabel: string;
  cursor: Date;
  onJumpToDate: (date: Date) => void;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  searchCards: Card[];
  accentFor: (projectId: string) => AccentName;
  onSearchSelect: (card: Card) => void;
}

/** Calendar header: title + period (click to jump to any date), a
 *  month/week/day/timeline toggle, period navigation, a multi-project
 *  show/hide filter, and search. Stacks gracefully on small screens. */
export function CalendarToolbar({
  view,
  onViewChange,
  projects,
  visibleProjectIds,
  onToggleProject,
  onShowAllProjects,
  onShowOnlyProject,
  periodLabel,
  cursor,
  onJumpToDate,
  onPrev,
  onNext,
  onToday,
  searchCards,
  accentFor,
  onSearchSelect,
}: CalendarToolbarProps) {
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const [projectFilterOpen, setProjectFilterOpen] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[linear-gradient(135deg,var(--accent-from),var(--accent-to))] text-[var(--accent-fg)] shadow-[0_12px_26px_-12px_var(--accent-glow)]">
            <CalendarDays size={22} />
          </span>
          <div>
            <h1 className="gradient-text font-display text-headline font-bold leading-none">Calendar</h1>
            <div className="mt-1">
              <MiniMonthPicker
                open={monthPickerOpen}
                onOpenChange={setMonthPickerOpen}
                label={periodLabel}
                cursor={cursor}
                onSelect={onJumpToDate}
              />
            </div>
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

        <div className="ml-auto flex items-center gap-2">
          <CalendarSearch cards={searchCards} accentFor={accentFor} onSelect={onSearchSelect} />
          <CalendarProjectFilter
            open={projectFilterOpen}
            onOpenChange={setProjectFilterOpen}
            projects={projects}
            visibleIds={visibleProjectIds}
            onToggle={onToggleProject}
            onShowAll={onShowAllProjects}
            onShowOnly={onShowOnlyProject}
          />
        </div>
      </div>

      {/* Color-key legend: only useful with several projects at once — each dot
       *  doubles as a show/hide toggle, same effect as the filter popover. */}
      {projects.length > 1 && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          {projects.map((project) => {
            const visible = visibleProjectIds.has(project.id);
            return (
              <button
                key={project.id}
                type="button"
                onClick={() => onToggleProject(project.id)}
                style={accentVars(project.accent)}
                className={cn(
                  'inline-flex items-center gap-1.5 text-xs font-medium transition-opacity',
                  visible ? 'text-fg-muted' : 'text-fg-subtle opacity-45',
                )}
              >
                <span
                  aria-hidden
                  className="h-2 w-2 shrink-0 rounded-full bg-[linear-gradient(135deg,var(--accent-from),var(--accent-to))]"
                />
                {project.name}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Segmented({ value, onChange }: { value: CalendarView; onChange: (view: CalendarView) => void }) {
  return (
    <div className="glass inline-flex rounded-2xl p-1">
      {(['month', 'week', 'day', 'timeline'] as const).map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={value === option}
          onClick={() => onChange(option)}
          className={cn(
            'rounded-xl px-3.5 py-1.5 text-sm font-medium capitalize transition-colors',
            value === option
              ? 'bg-[linear-gradient(135deg,var(--accent-from),var(--accent-to))] text-[var(--accent-fg)] shadow-[0_8px_18px_-10px_var(--accent-glow)]'
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
