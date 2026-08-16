import { useParams, Link } from 'react-router-dom';
import { Eye, LockKeyhole } from 'lucide-react';
import { AuroraBackground } from '@/components/AuroraBackground';
import { Brand } from '@/components/shell/Brand';
import { GlassPanel } from '@/components/glass/GlassPanel';
import { Spinner } from '@/components/feedback/Spinner';
import { CardSurface } from '@/features/board/CardSurface';
import { accentVars } from '@/lib/accents';
import type { Label } from '@/types/database';
import { SharedProjectNotFoundError, type SharedCard } from './api';
import { useSharedProject } from './useProjectShare';

/**
 * The `/share/:token` public route (no login, no app shell). A deliberately
 * thin, read-only slice of a project's board — columns, cards, labels, due
 * dates — with no edit affordances, no comments, no member list, and no path
 * to billing/settings: this page renders on its own, outside `ProtectedRoute`
 * and `AppShell` (see App.tsx), so there is nothing else on it to navigate to
 * besides the Aurora brand mark (→ the marketing site).
 */
export function SharedProjectPage() {
  const { token } = useParams<{ token: string }>();
  const { data, isLoading, isError, error } = useSharedProject(token);

  return (
    <div className="relative min-h-dvh" style={data ? accentVars(data.project.accent) : undefined}>
      <AuroraBackground />
      <header className="relative z-10 flex items-center justify-between px-5 py-5 sm:px-8">
        <Link to="/" aria-label="Aurora home">
          <Brand />
        </Link>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--glass-border)] bg-[var(--glass-fill)] px-3 py-1 text-xs font-medium text-fg-muted">
          <Eye size={13} aria-hidden /> Read-only view
        </span>
      </header>

      <main className="relative z-10 px-4 pb-16 sm:px-8">
        {isLoading && (
          <div className="grid place-items-center py-24">
            <Spinner size={32} />
          </div>
        )}

        {isError && (
          <InvalidLinkNotice
            message={
              error instanceof SharedProjectNotFoundError
                ? error.message
                : "Couldn't load this board. Please try again in a moment."
            }
          />
        )}

        {data && <SharedBoard project={data.project} columns={data.columns} cards={data.cards} />}
      </main>
    </div>
  );
}

function InvalidLinkNotice({ message }: { message: string }) {
  return (
    <GlassPanel className="mx-auto mt-12 flex max-w-md flex-col items-center gap-3 p-8 text-center">
      <LockKeyhole size={28} className="text-fg-subtle" aria-hidden />
      <h1 className="font-display text-title font-semibold text-fg">Link not available</h1>
      <p className="text-sm text-fg-muted">{message}</p>
      <Link to="/" className="mt-2 text-sm font-semibold text-[var(--accent-from)] hover:underline">
        Go to Aurora
      </Link>
    </GlassPanel>
  );
}

function SharedBoard({
  project,
  columns,
  cards,
}: {
  project: { name: string; description: string | null };
  columns: { id: string; name: string; position: number }[];
  cards: SharedCard[];
}) {
  const sortedColumns = [...columns].sort((a, b) => a.position - b.position);
  const cardsByColumn = new Map<string, SharedCard[]>();
  for (const card of cards) {
    const bucket = cardsByColumn.get(card.columnId);
    if (bucket) bucket.push(card);
    else cardsByColumn.set(card.columnId, [card]);
  }
  for (const bucket of cardsByColumn.values()) bucket.sort((a, b) => a.position - b.position);

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6">
        <h1 className="gradient-text font-display text-headline font-bold">{project.name}</h1>
        {project.description && (
          <p className="mt-2 max-w-prose text-fg-muted">{project.description}</p>
        )}
      </div>

      {sortedColumns.length === 0 ? (
        <GlassPanel className="p-8 text-center text-fg-muted">This board has no columns yet.</GlassPanel>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {sortedColumns.map((column) => {
            const columnCards = cardsByColumn.get(column.id) ?? [];
            return (
              <GlassPanel key={column.id} className="flex w-72 shrink-0 flex-col gap-3 p-3.5">
                <div className="flex items-center justify-between px-1">
                  <h2 className="truncate text-sm font-semibold text-fg">{column.name}</h2>
                  <span className="text-xs text-fg-subtle">{columnCards.length}</span>
                </div>
                <ul className="flex flex-col gap-2.5">
                  {columnCards.map((card) => (
                    <li key={card.id} className="list-none">
                      <CardSurface
                        title={card.title}
                        description={card.description}
                        dueDate={card.dueDate}
                        // SharedLabel only carries name/color (never an id — the
                        // public payload has no reason to leak internal label
                        // ids); CardSurface only reads name/color off each entry,
                        // so a stable synthetic id (the name itself) is enough to
                        // satisfy the Label shape it expects.
                        labels={card.labels.map(
                          (l) =>
                            ({
                              id: l.name,
                              project_id: '',
                              name: l.name,
                              color: l.color,
                              created_at: '',
                            }) satisfies Label,
                        )}
                      />
                    </li>
                  ))}
                  {columnCards.length === 0 && (
                    <li className="list-none px-1 py-2 text-xs text-fg-subtle">No cards</li>
                  )}
                </ul>
              </GlassPanel>
            );
          })}
        </div>
      )}
    </div>
  );
}
