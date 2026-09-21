import { Check, ListFilter } from 'lucide-react';
import { ToolbarPopover } from '@/components/forms/ToolbarPopover';
import { accentVars } from '@/lib/accents';
import type { Project } from '@/types/database';

interface CalendarProjectFilterProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projects: Project[];
  visibleIds: Set<string>;
  onToggle: (id: string) => void;
  onShowAll: () => void;
  onShowOnly: (id: string) => void;
}

/**
 * Outlook's "calendar list" — show/hide several projects on the Calendar at
 * once instead of the old single-project dropdown. Every project is visible
 * by default (see useVisibleProjects), so this is purely a *narrowing* tool,
 * never a required setup step.
 */
export function CalendarProjectFilter({
  open,
  onOpenChange,
  projects,
  visibleIds,
  onToggle,
  onShowAll,
  onShowOnly,
}: CalendarProjectFilterProps) {
  const allVisible = visibleIds.size === projects.length;
  const triggerLabel = allVisible
    ? 'All projects'
    : visibleIds.size === 0
      ? 'No projects'
      : visibleIds.size === 1
        ? (projects.find((p) => visibleIds.has(p.id))?.name ?? '1 project')
        : `${visibleIds.size} of ${projects.length} projects`;

  return (
    <ToolbarPopover
      open={open}
      onClose={() => onOpenChange(false)}
      title="Show projects"
      trigger={
        <button
          type="button"
          onClick={() => onOpenChange(!open)}
          aria-haspopup="true"
          aria-expanded={open}
          className="glass flex h-9 items-center gap-1.5 rounded-xl px-3 text-sm font-medium text-fg-muted transition-colors hover:text-fg"
        >
          <ListFilter size={15} />
          <span className="max-w-[10rem] truncate">{triggerLabel}</span>
        </button>
      }
    >
      <div className="flex flex-col gap-0.5">
        <button
          type="button"
          onClick={onShowAll}
          disabled={allVisible}
          className="rounded-lg px-2 py-1.5 text-left text-xs font-semibold uppercase tracking-wide text-[var(--accent-from)] transition-opacity disabled:opacity-40"
        >
          Show all
        </button>
        {projects.map((project) => {
          const visible = visibleIds.has(project.id);
          return (
            <div
              key={project.id}
              style={accentVars(project.accent)}
              className="group flex items-center gap-1 rounded-xl px-1 py-0.5"
            >
              <button
                type="button"
                onClick={() => onToggle(project.id)}
                aria-pressed={visible}
                className="flex flex-1 items-center gap-2 rounded-lg px-1.5 py-1.5 text-left text-sm font-medium text-fg transition-colors hover:bg-[var(--glass-fill)]"
              >
                <span
                  className="grid h-4 w-4 shrink-0 place-items-center rounded-[0.35rem] border border-[color:var(--accent-from)]"
                  style={
                    visible
                      ? { background: 'linear-gradient(135deg,var(--accent-from),var(--accent-to))' }
                      : undefined
                  }
                >
                  {visible && <Check size={11} className="text-[var(--accent-fg)]" />}
                </span>
                <span className="truncate">{project.name}</span>
              </button>
              <button
                type="button"
                onClick={() => onShowOnly(project.id)}
                className="shrink-0 rounded-md px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-fg-subtle opacity-0 transition-opacity hover:text-fg group-hover:opacity-100"
              >
                Only
              </button>
            </div>
          );
        })}
        {projects.length === 0 && <p className="px-2 py-1.5 text-sm text-fg-muted">No projects yet.</p>}
      </div>
    </ToolbarPopover>
  );
}
