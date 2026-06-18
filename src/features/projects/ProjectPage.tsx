import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, KanbanSquare } from 'lucide-react';
import { GlassPanel } from '@/components/glass/GlassPanel';
import { Badge } from '@/components/Badge';
import { Spinner } from '@/components/feedback/Spinner';
import { Reveal } from '@/components/motion/Reveal';
import { useAuth } from '@/hooks/useAuth';
import { accentVars } from '@/lib/accents';
import { useProject } from './useProjects';

/** A single project. The Kanban board lands here in Phase 4 — for now an
 *  accent-themed header plus a placeholder. RLS guarantees that a project the
 *  user can't access simply isn't returned. */
export function ProjectPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { user } = useAuth();
  const { data: project, isLoading } = useProject(projectId);

  if (isLoading) {
    return (
      <div className="grid place-items-center py-24">
        <Spinner size={32} />
      </div>
    );
  }

  if (!project) {
    return (
      <GlassPanel className="mx-auto mt-8 flex max-w-xl flex-col items-center gap-4 p-10 text-center">
        <h1 className="font-display text-title font-semibold text-fg">Project not found</h1>
        <p className="text-fg-muted">
          It may have been deleted, or you don&apos;t have access to it.
        </p>
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--accent-from)] hover:underline"
        >
          <ArrowLeft size={16} /> Back to projects
        </Link>
      </GlassPanel>
    );
  }

  const isOwner = project.owner_id === user?.id;

  return (
    <div className="flex flex-col gap-8" style={accentVars(project.accent)}>
      <Reveal>
        <header className="pt-2">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-fg-muted transition-colors hover:text-fg"
          >
            <ArrowLeft size={16} /> Projects
          </Link>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <h1 className="gradient-text font-display text-headline font-bold">{project.name}</h1>
            <Badge tone={isOwner ? 'accent' : 'neutral'}>{isOwner ? 'Owner' : 'Shared'}</Badge>
          </div>
          {project.description && (
            <p className="mt-2 max-w-prose text-fg-muted">{project.description}</p>
          )}
        </header>
      </Reveal>

      <Reveal delay={0.05}>
        <GlassPanel
          strong
          glow
          className="flex flex-col items-center gap-4 p-12 text-center"
        >
          <span
            className="grid h-14 w-14 place-items-center rounded-2xl bg-[linear-gradient(135deg,var(--accent-from),var(--accent-to))] text-white shadow-[0_12px_26px_-12px_var(--accent-glow)]"
            aria-hidden
          >
            <KanbanSquare size={26} />
          </span>
          <h2 className="font-display text-title font-semibold text-fg">Board coming soon</h2>
          <p className="max-w-prose text-fg-muted">
            The Kanban board — columns, cards, and drag-and-drop — arrives in Phase 4. This
            workspace is ready and waiting for it.
          </p>
        </GlassPanel>
      </Reveal>
    </div>
  );
}
