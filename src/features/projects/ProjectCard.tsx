import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Layers, Pencil, Trash2 } from 'lucide-react';
import { GlassCard } from '@/components/glass/GlassCard';
import { Badge } from '@/components/Badge';
import { ACCENTS } from '@/lib/accents';
import { cn } from '@/lib/cn';
import type { Project } from '@/types/database';

interface ProjectCardProps {
  project: Project;
  isOwner: boolean;
  /** Larger "hero" tile in the bento grid. */
  featured?: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

/** One project as a vivid Aurora glass card that floats and tilts. The whole
 *  surface links to the board; owners get edit/delete actions layered above. */
export function ProjectCard({ project, isOwner, featured = false, onEdit, onDelete }: ProjectCardProps) {
  return (
    <GlassCard
      accent={project.accent}
      className={cn('group relative flex h-full flex-col overflow-hidden', featured ? 'p-6 sm:p-7' : 'p-5')}
    >
      {/* Soft accent orb for depth, clipped to the card. */}
      <span
        aria-hidden
        className="pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full opacity-60 blur-2xl"
        style={{ background: 'radial-gradient(circle, var(--accent-from), transparent 70%)' }}
      />

      {/* Stretched link: accessible click target covering the card. */}
      <Link
        to={`/projects/${project.id}`}
        aria-label={`Open ${project.name}`}
        className="absolute inset-0 z-0 rounded-[inherit]"
      />

      <div className="relative flex h-full flex-col">
        <div className="flex items-start justify-between gap-3">
          <span
            className={cn(
              'grid place-items-center rounded-2xl bg-[linear-gradient(135deg,var(--accent-from),var(--accent-to))] text-white shadow-[0_12px_26px_-10px_var(--accent-glow)] ring-1 ring-white/20',
              featured ? 'h-14 w-14' : 'h-11 w-11',
            )}
            aria-hidden
          >
            <Layers size={featured ? 26 : 20} />
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

        <div className="mt-4 flex-1">
          <h2
            className={cn(
              'font-display font-semibold text-fg',
              featured ? 'text-2xl sm:text-3xl' : 'text-lg',
            )}
          >
            {project.name}
          </h2>
          {project.description ? (
            <p className={cn('mt-1.5 text-sm text-fg-subtle', featured ? 'line-clamp-3' : 'line-clamp-2')}>
              {project.description}
            </p>
          ) : (
            <p className="mt-1.5 text-sm text-fg-subtle">{ACCENTS[project.accent].label} accent</p>
          )}
        </div>

        <div className="mt-4 flex items-center justify-between gap-2">
          <Badge tone={isOwner ? 'accent' : 'neutral'}>{isOwner ? 'Owner' : 'Shared'}</Badge>
          <span className="flex items-center gap-1 text-xs font-medium text-fg-subtle opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            Open board <ArrowUpRight size={14} />
          </span>
        </div>
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
      className="grid h-8 w-8 place-items-center rounded-full text-fg-muted opacity-80 transition-all hover:-translate-y-0.5 hover:bg-[var(--glass-fill)] hover:text-fg hover:opacity-100"
    >
      {children}
    </button>
  );
}
