import type { ReactNode } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, LayoutGrid, NotebookPen } from 'lucide-react';
import { cn } from '@/lib/cn';
import { GlassPanel } from '@/components/glass/GlassPanel';
import { Badge } from '@/components/Badge';
import { Spinner } from '@/components/feedback/Spinner';
import { Reveal } from '@/components/motion/Reveal';
import { useAuth } from '@/hooks/useAuth';
import { accentVars } from '@/lib/accents';
import { Board } from '@/features/board';
import { NotesPanel } from '@/features/notes';
import { MembersBar, useMyRole, useProjectRealtime } from '@/features/members';
import { useProject } from './useProjects';

type ProjectTab = 'board' | 'notes';

/** A single project: an accent-themed header above its Kanban board (Phase 4).
 *  RLS guarantees that a project the user can't access simply isn't returned. */
export function ProjectPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { user } = useAuth();
  const { data: project, isLoading } = useProject(projectId);
  const [searchParams, setSearchParams] = useSearchParams();
  const tab: ProjectTab = searchParams.get('tab') === 'notes' ? 'notes' : 'board';

  // Live collaboration for the active project: stream other members' changes into
  // the board/notes/members caches. Role drives read-only vs. editable.
  useProjectRealtime(projectId);
  const role = useMyRole(projectId);

  function selectTab(next: ProjectTab) {
    setSearchParams(
      (params) => {
        if (next === 'board') params.delete('tab');
        else params.set('tab', next);
        return params;
      },
      { replace: true },
    );
  }

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
  // Optimistically editable until membership resolves, so editors never flash a
  // read-only board; once role is known, viewers lose write affordances (RLS is
  // the real guarantee either way).
  const canEdit = role !== 'viewer';
  const roleLabel = isOwner ? 'Owner' : role ? role[0]!.toUpperCase() + role.slice(1) : 'Shared';

  return (
    <div className="flex flex-col gap-8" style={accentVars(project.accent)}>
      <Reveal>
        <header className="pt-2">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <Link
                to="/"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-fg-muted transition-colors hover:text-fg"
              >
                <ArrowLeft size={16} /> Projects
              </Link>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <h1 className="gradient-text font-display text-headline font-bold">{project.name}</h1>
                <Badge tone={isOwner ? 'accent' : role === 'viewer' ? 'neutral' : 'info'}>
                  {roleLabel}
                </Badge>
              </div>
              {project.description && (
                <p className="mt-2 max-w-prose text-fg-muted">{project.description}</p>
              )}
            </div>

            <div className="shrink-0 pt-1">
              <MembersBar projectId={project.id} accent={project.accent} isOwner={isOwner} />
            </div>
          </div>

          <div
            role="tablist"
            aria-label="Project views"
            className="mt-5 inline-flex items-center gap-1 rounded-2xl border border-[var(--glass-border)] p-1"
          >
            <TabButton
              active={tab === 'board'}
              onClick={() => selectTab('board')}
              icon={<LayoutGrid size={15} />}
            >
              Board
            </TabButton>
            <TabButton
              active={tab === 'notes'}
              onClick={() => selectTab('notes')}
              icon={<NotebookPen size={15} />}
            >
              Notes
            </TabButton>
          </div>
        </header>
      </Reveal>

      {tab === 'board' ? (
        <Board projectId={project.id} accent={project.accent} canEdit={canEdit} />
      ) : (
        <NotesPanel projectId={project.id} canEdit={canEdit} />
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-sm font-semibold transition-colors',
        active
          ? 'bg-[linear-gradient(110deg,var(--accent-from),var(--accent-to))] text-white shadow-[0_8px_18px_-10px_var(--accent-glow)]'
          : 'text-fg-muted hover:text-fg',
      )}
    >
      {icon}
      {children}
    </button>
  );
}
