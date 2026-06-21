import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FolderPlus, Plus } from 'lucide-react';
import { GlassPanel } from '@/components/glass/GlassPanel';
import { GradientButton } from '@/components/buttons/GradientButton';
import { Skeleton } from '@/components/feedback/Skeleton';
import { Reveal } from '@/components/motion/Reveal';
import { useAuth } from '@/hooks/useAuth';
import { PendingInvitations } from '@/features/members';
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
  const { data: projects, isLoading, isError } = useProjects();
  const createProject = useCreateProject();
  const updateProject = useUpdateProject();
  const deleteProject = useDeleteProject();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [deleting, setDeleting] = useState<Project | null>(null);
  // Bumped on every open so the form modal remounts and re-seeds from `initial`.
  const [formKey, setFormKey] = useState(0);
  const [searchParams, setSearchParams] = useSearchParams();

  const openCreate = useCallback(() => {
    setEditing(null);
    setFormKey((key) => key + 1);
    setFormOpen(true);
  }, []);

  // The sidebar's "New project" button navigates here with ?new=1 — open the
  // create modal once, then strip the param so it doesn't re-trigger.
  const wantsNew = searchParams.has('new');
  useEffect(() => {
    if (!wantsNew) return;
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
    if (editing) {
      await updateProject.mutateAsync({ id: editing.id, ...values });
    } else {
      await createProject.mutateAsync(values);
    }
    setFormOpen(false);
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
          <GradientButton leftIcon={<Plus size={18} />} onClick={openCreate}>
            New project
          </GradientButton>
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
    </div>
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
          className="grid h-14 w-14 place-items-center rounded-2xl bg-[linear-gradient(135deg,var(--accent-from),var(--accent-to))] text-white shadow-[0_12px_26px_-12px_var(--accent-glow)]"
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
