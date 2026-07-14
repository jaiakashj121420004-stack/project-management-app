import { useMemo } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Activity } from 'lucide-react';
import { Avatar } from '@/components/Avatar';
import { Spinner } from '@/components/feedback/Spinner';
import type { ActivityEntry } from '@/types/database';
import { useCardActivity, useProjectActivityInfinite } from './useActivity';

function metaString(meta: Record<string, unknown>, key: string): string | undefined {
  const value = meta[key];
  return typeof value === 'string' && value.trim() ? value : undefined;
}

/** The human verb phrase for an entry. Omits the card title in a card-scoped feed. */
function phrase(entry: ActivityEntry, scoped: boolean): string {
  const card = metaString(entry.meta, 'card_title') ?? 'a card';
  const on = scoped ? '' : ` on ${card}`;
  switch (entry.verb) {
    case 'commented':
      return scoped ? 'commented' : `commented on ${card}`;
    case 'requested_review':
      return `requested review${on}`;
    case 'approved_review':
      return scoped ? 'approved this card' : `approved ${card}`;
    case 'requested_changes':
      return `requested changes${on}`;
    case 'cleared_review':
      return `cleared the review${on}`;
    default:
      return scoped ? 'updated this card' : `updated ${card}`;
  }
}

function timeAgo(iso: string): string {
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true });
  } catch {
    return '';
  }
}

interface ActivityFeedProps {
  projectId: string;
  /** When set, the feed is scoped to a single card. */
  cardId?: string;
}

/** Read-only activity feed, project-wide or scoped to a card. */
export function ActivityFeed({ projectId, cardId }: ActivityFeedProps) {
  const scoped = Boolean(cardId);

  // Card feed is one bounded slice; the project feed pages older activity in.
  const cardQuery = useCardActivity(cardId ? projectId : undefined, cardId);
  const projectQuery = useProjectActivityInfinite(cardId ? undefined : projectId);

  const entries = useMemo<ActivityEntry[]>(
    () => (scoped ? (cardQuery.data ?? []) : (projectQuery.data?.pages.flat() ?? [])),
    [scoped, cardQuery.data, projectQuery.data],
  );

  const isLoading = scoped ? cardQuery.isLoading : projectQuery.isLoading;

  if (isLoading) {
    return (
      <div className="flex justify-center py-6">
        <Spinner size={20} />
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <p className="flex items-center gap-2 py-2 text-sm text-fg-subtle">
        <Activity size={15} aria-hidden /> No activity yet.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-3">
        {entries.map((entry) => {
          const actor = metaString(entry.meta, 'actor_name') ?? 'Someone';
          const snippet = entry.verb === 'commented' ? metaString(entry.meta, 'snippet') : undefined;
          return (
            <li key={entry.id} className="flex gap-2.5">
              <Avatar name={actor} size={26} className="mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm text-fg-muted">
                  <span className="font-semibold text-fg">{actor}</span> {phrase(entry, scoped)}{' '}
                  <span className="text-fg-subtle">· {timeAgo(entry.created_at)}</span>
                </p>
                {snippet && <p className="truncate text-sm text-fg-subtle">“{snippet}”</p>}
              </div>
            </li>
          );
        })}
      </ul>

      {!scoped && projectQuery.hasNextPage && (
        <button
          type="button"
          onClick={() => void projectQuery.fetchNextPage()}
          disabled={projectQuery.isFetchingNextPage}
          className="mx-auto inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-fg-muted transition-colors hover:bg-[var(--glass-fill)] hover:text-fg disabled:opacity-60"
        >
          {projectQuery.isFetchingNextPage ? (
            <>
              <Spinner size={13} className="text-current" /> Loading…
            </>
          ) : (
            'Load older activity'
          )}
        </button>
      )}
    </div>
  );
}
