import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FolderPlus, Plus } from 'lucide-react';
import { GlassPanel } from '@/components/glass/GlassPanel';
import { GradientButton } from '@/components/buttons/GradientButton';
import { Skeleton } from '@/components/feedback/Skeleton';
import { Reveal } from '@/components/motion/Reveal';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/features/auth/useProfile';
import { PendingInvitations } from '@/features/members';
import { UpgradeModal } from '@/features/billing';
import { FREE_PROJECT_LIMIT, isAtProjectLimit } from '@/lib/plans';
import type { Project } from '@/types/database';
import { ProjectCard } from './ProjectCard';
import { ProjectFormModal } from './ProjectFormModal';
import { DeleteProjectDialog } from './DeleteProjectDialog';
import {
  useCreateProject,
  useDeleteProject,
  useProjects,
  useUpdateProject,
} from './useProjects';
import type { ProjectFormInput } from './schemas';

/** The Projects dashboard (plan.md §5, Phase 3): the user's workspaces as vivid
 *  Aurora glass cards, with create / edit / delete. */
export function ProjectsPage() {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const { data: projects, isLoading, isError } = useProjects();
  const createProject = useCreateProject();
  const updateProject = useUpdateProject();
  const deleteProject = useDeleteProject();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [deleting, setDeleting] = useState<Project | null>(null);
  // Bumped on every open so the form modal remounts and re-seeds from `initial`.
  const [formKey, setFormKey] = useState(0);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  const plan = profile?.plan ?? 'free';
  const ownedCount = projects?.filter((project) => project.owner_id === user?.id).length ?? 0;
  const atProjectLimit = isAtProjectLimit(plan, ownedCount);

  const openCreate = useCallback(() => {
    // Free users at their project cap get the upgrade prompt instead of the form.
    if (atProjectLimit) {
      setUpgradeOpen(true);
      return;
    }
    setEditing(null);
    setFormKey((key) => key + 1);
    setFormOpen(true);
  }, [atProjectLimit]);

  // The sidebar's "New project" button navigates here with ?new=1 — open the
  // create modal once, then strip the param so it doesn't re-trigger.
  const wantsNew = searchParams.has('new');
  useEffect(() => {
    if (!wantsNew) return;
    // Deliberate one-time, URL-driven side effect: ?new=1 opens the create modal
    // once, then we strip the param so it can't re-fire (not a render loop).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    openCreate();
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('new');
        return next;
      },
      { replace: true },
    );
  }, [wantsNew, openCreate, setSearchParams]);

  function openEdit(project: Project) {
    setEditing(project);
    setFormKey((key) => key + 1);
    setFormOpen(true);
  }

  async function handleSubmit(values: ProjectFormInput) {
    try {
      if (editing) {
        await updateProject.mutateAsync({ id: editing.id, ...values });
      } else {
        await createProject.mutateAsync(values);
      }
      setFormOpen(false);
    } catch (error) {
      // The DB trigger is the real gate — surface the upgrade prompt if a free
      // user slipped past the client check (e.g. a stale project count).
      if (isProjectLimitError(error)) {
        setFormOpen(false);
        setUpgradeOpen(true);
        return;
      }
      throw error;
    }
  }

  async function handleConfirmDelete() {
    if (!deleting) return;
    await deleteProject.mutateAsync(deleting.id);
    setDeleting(null);
  }

  const hasProjects = Boolean(projects && projects.length > 0);

  return (
    <div className="flex flex-col gap-8">
      <Reveal>
        <header className="flex flex-wrap items-end justify-between gap-4 pt-2">
          <div>
            <p className="text-sm font-medium text-fg-muted">Your workspaces</p>
            <h1 className="gradient-text mt-1 font-display text-headline font-bold">Projects</h1>
            <p className="mt-2 max-w-prose text-fg-muted">
              Every idea gets its own colorful space. Create a project, pick an accent, and start
              planning.
            </p>
          </div>
          <div className="flex flex-col items-center gap-1.5 sm:items-end">
            <GradientButton leftIcon={<Plus size={18} />} onClick={openCreate}>
              New project
            </GradientButton>
            {plan === 'free' && (
              <p className="text-xs text-fg-subtle">
                {ownedCount} / {FREE_PROJECT_LIMIT} projects used
              </p>
            )}
          </div>
        </header>
      </Reveal>

      <PendingInvitations />

      {isLoading ? (
        <LoadingGrid />
      ) : isError ? (
        <GlassPanel className="p-6 text-center text-fg-muted">
          Couldn&apos;t load your projects. Check your connection and try again.
        </GlassPanel>
      ) : hasProjects ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {projects!.map((project, index) => (
            <Reveal key={project.id} delay={index * 0.05}>
              <ProjectCard
                project={project}
                isOwner={project.owner_id === user?.id}
                onEdit={() => openEdit(project)}
                onDelete={() => setDeleting(project)}
              />
            </Reveal>
          ))}
        </div>
      ) : (
        <EmptyState onCreate={openCreate} />
      )}

      <ProjectFormModal
        key={formKey}
        open={formOpen}
        onClose={() => setFormOpen(false)}
        mode={editing ? 'edit' : 'create'}
        initial={
          editing
            ? { name: editing.name, description: editing.description, accent: editing.accent }
            : undefined
        }
        onSubmit={handleSubmit}
        isPending={createProject.isPending || updateProject.isPending}
      />

      <DeleteProjectDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        projectName={deleting?.name ?? ''}
        onConfirm={handleConfirmDelete}
        isPending={deleteProject.isPending}
      />

      <UpgradeModal
        open={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        reason={`You've reached the Free plan's ${FREE_PROJECT_LIMIT}-project limit. Go Pro for unlimited projects.`}
      />
    </div>
  );
}

function isProjectLimitError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof error.message === 'string' &&
    error.message.includes('PROJECT_LIMIT_REACHED')
  );
}

function LoadingGrid() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <Skeleton key={index} className="h-44 rounded-3xl" />
      ))}
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <Reveal>
      <GlassPanel
        strong
        glow
        className="mx-auto mt-4 flex max-w-xl flex-col items-center gap-4 p-10 text-center"
      >
        <span
          className="grid h-14 w-14 place-items-center rounded-2xl bg-[linear-gradient(135deg,var(--accent-from),var(--accent-to))] text-[var(--accent-fg)] shadow-[0_12px_26px_-12px_var(--accent-glow)]"
          aria-hidden
        >
          <FolderPlus size={26} />
        </span>
        <h2 className="font-display text-title font-semibold text-fg">No projects yet</h2>
        <p className="text-fg-muted">
          Create your first workspace to start building boards, lists, and notes.
        </p>
        <GradientButton leftIcon={<Plus size={18} />} onClick={onCreate}>
          New project
        </GradientButton>
      </GlassPanel>
    </Reveal>
  );
}
