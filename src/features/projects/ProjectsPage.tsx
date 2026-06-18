import { useState } from 'react';
import { FolderPlus, Plus, Sparkles } from 'lucide-react';
import { GlassPanel } from '@/components/glass/GlassPanel';
import { GradientButton } from '@/components/buttons/GradientButton';
import { Skeleton } from '@/components/feedback/Skeleton';
import { Reveal } from '@/components/motion/Reveal';
import { cn } from '@/lib/cn';
import { useAuth } from '@/hooks/useAuth';
import type { Project } from '@/types/database';
import { ProjectCard } from './ProjectCard';
import { ProjectFormModal } from './ProjectFormModal';
import { DeleteProjectDialog } from './DeleteProjectDialog';
import { useCreateProject, useDeleteProject, useProjects, useUpdateProject } from './useProjects';
import type { ProjectFormInput } from './schemas';

/** Bento-grid span for a project tile: the first is a hero, with periodic wides. */
function spanFor(index: number): string {
  if (index === 0) return 'sm:col-span-2 sm:row-span-2';
  if (index % 7 === 4) return 'lg:col-span-2';
  return '';
}

/** The Projects dashboard (plan.md §5): the user's workspaces as a constellation
 *  of floating Aurora glass cards, with create / edit / delete. */
export function ProjectsPage() {
  const { user } = useAuth();
  const { data: projects, isLoading, isError } = useProjects();
  const createProject = useCreateProject();
  const updateProject = useUpdateProject();
  const deleteProject = useDeleteProject();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [deleting, setDeleting] = useState<Project | null>(null);
  const [formKey, setFormKey] = useState(0);

  function openCreate() {
    setEditing(null);
    setFormKey((key) => key + 1);
    setFormOpen(true);
  }

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
  const count = projects?.length ?? 0;

  return (
    <div className="flex flex-col gap-8">
      <Reveal>
        <header className="flex flex-wrap items-end justify-between gap-4 pt-2">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border bg-[var(--glass-fill)] px-3 py-1 text-xs font-medium text-fg-muted backdrop-blur-sm">
              <Sparkles size={13} className="text-[var(--accent-from)]" />
              Your workspaces
            </span>
            <h1 className="gradient-text mt-3 font-display text-display font-bold leading-none">
              Projects
            </h1>
            <p className="mt-3 max-w-prose text-fg-muted">
              Every idea gets its own colorful space. Create a project, pick an accent, and start
              planning.
              {count > 0 && (
                <span className="text-fg-subtle">
                  {' '}
                  · {count} {count === 1 ? 'workspace' : 'workspaces'}
                </span>
              )}
            </p>
          </div>
          <GradientButton size="lg" leftIcon={<Plus size={18} />} onClick={openCreate}>
            New project
          </GradientButton>
        </header>
      </Reveal>

      {isLoading ? (
        <LoadingGrid />
      ) : isError ? (
        <GlassPanel className="p-6 text-center text-fg-muted">
          Couldn&apos;t load your projects. Check your connection and try again.
        </GlassPanel>
      ) : hasProjects ? (
        <div className="grid grid-cols-1 gap-4 sm:auto-rows-[212px] sm:grid-flow-row-dense sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
          {projects!.map((project, index) => (
            <Reveal key={project.id} delay={index * 0.05} className={cn(spanFor(index), 'h-full')}>
              <ProjectCard
                project={project}
                isOwner={project.owner_id === user?.id}
                featured={index === 0}
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
    <div className="grid grid-cols-1 gap-4 sm:auto-rows-[212px] sm:grid-flow-row-dense sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 7 }).map((_, index) => (
        <Skeleton key={index} className={cn('h-full min-h-44 rounded-3xl', index === 0 && 'sm:col-span-2 sm:row-span-2')} />
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
        gradientBorder
        className="mx-auto mt-4 flex max-w-xl flex-col items-center gap-4 p-10 text-center"
      >
        <span
          className="grid h-16 w-16 place-items-center rounded-3xl bg-[linear-gradient(135deg,var(--accent-from),var(--accent-to))] text-white shadow-[0_16px_32px_-12px_var(--accent-glow)] ring-1 ring-white/20 motion-safe:animate-float"
          aria-hidden
        >
          <FolderPlus size={28} />
        </span>
        <h2 className="font-display text-title font-semibold text-fg">No projects yet</h2>
        <p className="text-fg-muted">
          Create your first workspace to start building boards, lists, and notes.
        </p>
        <GradientButton size="lg" leftIcon={<Plus size={18} />} onClick={onCreate}>
          New project
        </GradientButton>
      </GlassPanel>
    </Reveal>
  );
}
