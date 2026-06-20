import { Link } from 'react-router-dom';
import { ArrowRight, NotebookPen } from 'lucide-react';
import { GlassPanel } from '@/components/glass/GlassPanel';
import { Spinner } from '@/components/feedback/Spinner';
import { Reveal } from '@/components/motion/Reveal';
import { accentVars } from '@/lib/accents';
import { useProjects } from '@/features/projects/useProjects';

/**
 * The global Notes destination. Notes live inside a project, so this is a simple
 * picker: choose a project and jump straight to its Notes tab. RLS scopes the
 * list to projects the user belongs to.
 */
export function NotesHome() {
  const { data: projects, isLoading, isError } = useProjects();

  return (
    <div className="flex flex-col gap-6">
      <Reveal>
        <header className="flex items-center gap-3 pt-2">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[linear-gradient(135deg,var(--accent-from),var(--accent-to))] text-white shadow-[0_10px_24px_-12px_var(--accent-glow)]">
            <NotebookPen size={22} />
          </span>
          <div>
            <h1 className="gradient-text text-2xl font-bold leading-tight">Notes</h1>
            <p className="text-sm text-fg-muted">Pick a project to open its notes.</p>
          </div>
        </header>
      </Reveal>

      {isLoading ? (
        <div className="grid place-items-center py-24">
          <Spinner size={32} />
        </div>
      ) : isError ? (
        <GlassPanel className="p-6 text-center text-fg-muted">
          Couldn&apos;t load your projects. Check your connection and try again.
        </GlassPanel>
      ) : !projects || projects.length === 0 ? (
        <GlassPanel className="mx-auto mt-4 flex max-w-xl flex-col items-center gap-3 p-10 text-center">
          <p className="text-fg-muted">
            Create a project first — notes live inside each project.
          </p>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--accent-from)] hover:underline"
          >
            Go to projects <ArrowRight size={16} />
          </Link>
        </GlassPanel>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => (
            <Link
              key={project.id}
              to={`/projects/${project.id}?tab=notes`}
              style={accentVars(project.accent)}
              className="group"
            >
              <GlassPanel
                glow
                className="flex h-full items-center justify-between gap-3 p-5 transition-transform duration-200 ease-spring group-hover:-translate-y-1"
              >
                <div className="min-w-0">
                  <p className="truncate font-display text-lg font-semibold text-fg">
                    {project.name}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-sm text-fg-muted">
                    <NotebookPen size={14} /> Open notes
                  </p>
                </div>
                <ArrowRight
                  size={18}
                  className="shrink-0 text-fg-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--accent-from)]"
                />
              </GlassPanel>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
