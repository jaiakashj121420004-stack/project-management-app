import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Layers, Pencil, Trash2 } from 'lucide-react';
import { GlassCard } from '@/components/glass/GlassCard';
import { Badge } from '@/components/Badge';
import { ACCENTS } from '@/lib/accents';
import type { Project } from '@/types/database';

interface ProjectCardProps {
  project: Project;
  isOwner: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

/** One project as a vivid Aurora glass card. The whole surface links to the
 *  board; owners get edit/delete actions layered above the link. */
export function ProjectCard({ project, isOwner, onEdit, onDelete }: ProjectCardProps) {
  return (
    <GlassCard accent={project.accent} className="group relative h-full p-5">
      {/* Stretched link: accessible click target covering the card. */}
      <Link
        to={`/projects/${project.id}`}
        aria-label={`Open ${project.name}`}
        className="absolute inset-0 z-0 rounded-3xl"
      />

      <div className="relative flex items-start justify-between gap-3">
        <span
          className="grid h-11 w-11 place-items-center rounded-2xl bg-[linear-gradient(135deg,var(--accent-from),var(--accent-to))] text-[var(--accent-fg)] shadow-[0_10px_22px_-10px_var(--accent-glow)]"
          aria-hidden
        >
          <Layers size={20} />
        </span>

        {isOwner && (
          <div className="relative z-10 flex items-center gap-1">
            <CardAction label={`Edit ${project.name}`} onClick={onEdit}>
              <Pencil size={16} />
            </CardAction>
            <CardAction label={`Delete ${project.name}`} onClick={onDelete}>
              <Trash2 size={16} />
            </CardAction>
          </div>
        )}
      </div>

      <h2 className="mt-4 font-display text-lg font-semibold text-fg">{project.name}</h2>
      {project.description ? (
        <p className="mt-1 line-clamp-2 text-sm text-fg-subtle">{project.description}</p>
      ) : (
        <p className="mt-1 text-sm text-fg-subtle">{ACCENTS[project.accent].label} accent</p>
      )}

      <div className="mt-4 flex items-center gap-2">
        <Badge tone={isOwner ? 'accent' : 'neutral'}>{isOwner ? 'Owner' : 'Shared'}</Badge>
      </div>
    </GlassCard>
  );
}

/** Small icon button that sits above the stretched link without triggering it. */
function CardAction({
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
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onClick();
      }}
      className="grid h-8 w-8 place-items-center rounded-full text-fg-muted opacity-80 transition-colors hover:bg-[var(--glass-fill)] hover:text-fg hover:opacity-100"
    >
      {children}
    </button>
  );
}
