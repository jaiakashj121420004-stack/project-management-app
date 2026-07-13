import { lazy, Suspense, type ReactNode } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Activity, ArrowLeft, LayoutGrid, NotebookPen, PenTool } from 'lucide-react';
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
import { ProGate } from '@/features/billing';
import { ActivityFeed, useProjectIsPro } from '@/features/collaboration';
import { useProject } from './useProjects';

// Lazy-loaded so Konva/the canvas editor never ship to users who don't open a
// canvas (the canvas chunk is large — see prompts.md P3.1). Imported via a direct
// dynamic import, NOT the features/canvas barrel, so the eager graph stays clean.
const CanvasPanel = lazy(() =>
  import('@/features/canvas/CanvasPanel').then((module) => ({ default: module.CanvasPanel })),
);

type ProjectTab = 'board' | 'notes' | 'canvas' | 'activity';

/** A single project: an accent-themed header above its Kanban board (Phase 4).
 *  RLS guarantees that a project the user can't access simply isn't returned. */
export function ProjectPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { user } = useAuth();
  const { data: project, isLoading } = useProject(projectId);
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const tab: ProjectTab =
    tabParam === 'notes'
      ? 'notes'
      : tabParam === 'canvas'
        ? 'canvas'
        : tabParam === 'activity'
          ? 'activity'
          : 'board';

  // Live collaboration for the active project: stream other members' changes into
  // the board/notes/members caches. Role drives read-only vs. editable.
  useProjectRealtime(projectId);
  const role = useMyRole(projectId);
  const { data: isProBoard } = useProjectIsPro(projectId);

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
          to="/boards"
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
                to="/boards"
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
            className="mt-5 flex max-w-full items-center gap-1 overflow-x-auto rounded-2xl border border-[var(--glass-border)] p-1 [-ms-overflow-style:none] [scrollbar-width:none] sm:inline-flex sm:max-w-none [&::-webkit-scrollbar]:hidden"
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
            <TabButton
              active={tab === 'canvas'}
              onClick={() => selectTab('canvas')}
              icon={<PenTool size={15} />}
            >
              Canvas
            </TabButton>
            <TabButton
              active={tab === 'activity'}
              onClick={() => selectTab('activity')}
              icon={<Activity size={15} />}
            >
              Activity
            </TabButton>
          </div>
        </header>
      </Reveal>

      {tab === 'board' && <Board projectId={project.id} accent={project.accent} canEdit={canEdit} />}
      {tab === 'notes' && <NotesPanel projectId={project.id} canEdit={canEdit} />}
      {tab === 'canvas' && (
        <ProGate
          isPro={isProBoard}
          title="The Notes Canvas is a Pro feature"
          reason="Upgrade to Pro to sketch, lay out, and collaborate on an infinite per-project whiteboard."
        >
          <Suspense
            fallback={
              <div className="grid place-items-center py-24">
                <Spinner size={32} />
              </div>
            }
          >
            <CanvasPanel projectId={project.id} canEdit={canEdit} />
          </Suspense>
        </ProGate>
      )}
      {tab === 'activity' && (
        <GlassPanel className="p-5 sm:p-6">
          <ProGate
            isPro={isProBoard}
            title="The activity feed is a Pro feature"
            reason="Upgrade to Pro to see a live history of comments, reviews, and changes across this board."
          >
            <ActivityFeed projectId={project.id} />
          </ProGate>
        </GlassPanel>
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
        'inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-sm font-semibold transition-colors',
        active
          ? 'bg-[linear-gradient(110deg,var(--accent-from),var(--accent-to))] text-[var(--accent-fg)] shadow-[0_8px_18px_-10px_var(--accent-glow)]'
          : 'text-fg-muted hover:text-fg',
      )}
    >
      {icon}
      {children}
    </button>
  );
}
