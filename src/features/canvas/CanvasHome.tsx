import { Link } from 'react-router-dom';
import { ArrowRight, PenTool } from 'lucide-react';
import { GlassPanel } from '@/components/glass/GlassPanel';
import { Spinner } from '@/components/feedback/Spinner';
import { Reveal } from '@/components/motion/Reveal';
import { accentVars } from '@/lib/accents';
import { ProGate } from '@/features/billing';
import { useProjects } from '@/features/projects/useProjects';

/**
 * The global Canvas destination. Like NotesHome, canvases live inside a project,
 * so this is a picker: choose a project and jump to its Canvas tab. The whole
 * page is Pro-gated (free users get the upgrade CTA); the real enforcement is
 * project_is_pro() in RLS. This component is Konva-free — the heavy editor only
 * loads once a project's Canvas tab is opened (lazy import in ProjectPage).
 */
export function CanvasHome() {
  const { data: projects, isLoading, isError } = useProjects();

  return (
    <div className="flex flex-col gap-6">
      <Reveal>
        <header className="flex items-center gap-3 pt-2">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[linear-gradient(135deg,var(--accent-from),var(--accent-to))] text-white shadow-[0_10px_24px_-12px_var(--accent-glow)]">
            <PenTool size={22} />
          </span>
          <div>
            <h1 className="gradient-text text-2xl font-bold leading-tight">Canvas</h1>
            <p className="text-sm text-fg-muted">Pick a project to open its canvas.</p>
          </div>
        </header>
      </Reveal>

      <ProGate
        title="The Notes Canvas is a Pro feature"
        reason="Upgrade to Pro to sketch, lay out, and collaborate on an infinite per-project whiteboard."
      >
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
              Create a project first — canvases live inside each project.
            </p>
            <Link
              to="/boards"
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
                to={`/projects/${project.id}?tab=canvas`}
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
                      <PenTool size={14} /> Open canvas
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
      </ProGate>
    </div>
  );
}
