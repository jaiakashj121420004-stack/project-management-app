import { useMemo, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { PenTool, Plus, Sparkles } from 'lucide-react';
import { cn } from '@/lib/cn';
import { GlassPanel } from '@/components/glass/GlassPanel';
import { GradientButton } from '@/components/buttons/GradientButton';
import { Spinner } from '@/components/feedback/Spinner';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { PAGE_LABELS } from '@/lib/canvasPages';
import type { CanvasNoteSummary } from './api';
import { useCanvasList, useCreateCanvas } from './useCanvas';
import { CanvasEditor } from './CanvasEditor';

const DEFAULT_TITLE = 'Untitled canvas';

/**
 * The per-project Canvas tab: a list of canvases on the left and the Konva
 * editor on the right (single column on phones, where selecting a canvas swaps
 * the list for the editor). Access is membership/Pro-gated by RLS — this
 * component never filters by user. This module is lazy-loaded by ProjectPage so
 * Konva never ships to users who don't open a canvas.
 */
export function CanvasPanel({ projectId, canEdit }: { projectId: string; canEdit: boolean }) {
  const { data, isLoading, isError } = useCanvasList(projectId);
  const createCanvas = useCreateCanvas(projectId);
  const isDesktop = useMediaQuery('(min-width: 1024px)');

  const [selectedId, setSelectedId] = useState<string | null>(null);

  const canvases = useMemo(
    () =>
      [...(data ?? [])].sort(
        (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
      ),
    [data],
  );

  // The explicit choice if it still exists, else — on desktop only — the most
  // recently edited canvas. Phones stay on the list until one is tapped.
  const selected: CanvasNoteSummary | undefined =
    canvases.find((canvas) => canvas.id === selectedId) ?? (isDesktop ? canvases[0] : undefined);

  function handleCreate() {
    // Select the real canvas once the insert resolves (avoids opening a temp id).
    createCanvas.mutate(
      { title: DEFAULT_TITLE, tempId: crypto.randomUUID() },
      { onSuccess: (row) => setSelectedId(row.id) },
    );
  }

  if (isLoading) {
    return (
      <div className="grid place-items-center py-24">
        <Spinner size={32} />
      </div>
    );
  }

  if (isError) {
    return (
      <GlassPanel className="p-6 text-center text-fg-muted">
        Couldn&apos;t load this project&apos;s canvases. Check your connection and try again.
      </GlassPanel>
    );
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[18rem_minmax(0,1fr)]">
      <aside className={cn('flex-col gap-3', selected ? 'hidden lg:flex' : 'flex')}>
        <div className="flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-fg-muted">
            <PenTool size={15} /> Canvases
            {canvases.length > 0 && <span className="text-fg-subtle">· {canvases.length}</span>}
          </h2>
          {canEdit && (
            <GradientButton
              size="sm"
              leftIcon={<Plus size={15} />}
              onClick={handleCreate}
              isLoading={createCanvas.isPending}
            >
              New
            </GradientButton>
          )}
        </div>

        {canvases.length === 0 ? (
          <GlassPanel className="flex flex-col items-center gap-2 p-6 text-center">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[linear-gradient(135deg,var(--accent-from),var(--accent-to))] text-white">
              <Sparkles size={20} />
            </span>
            <p className="text-sm text-fg-muted">
              {canEdit
                ? 'No canvases yet. Sketch ideas, pin notes, and lay things out freely.'
                : 'No canvases have been added to this project yet.'}
            </p>
          </GlassPanel>
        ) : (
          <ul className="flex flex-col gap-2">
            {canvases.map((canvas) => (
              <li key={canvas.id}>
                <CanvasListItem
                  canvas={canvas}
                  active={canvas.id === selected?.id}
                  onSelect={() => setSelectedId(canvas.id)}
                />
              </li>
            ))}
          </ul>
        )}
      </aside>

      <section className={cn('min-h-[70vh]', selected ? 'block' : 'hidden lg:block')}>
        {selected ? (
          <GlassPanel className="h-full p-5 sm:p-6">
            <CanvasEditor
              key={selected.id}
              noteId={selected.id}
              projectId={projectId}
              canEdit={canEdit}
              onBack={() => setSelectedId(null)}
              onDeleted={() => setSelectedId(null)}
            />
          </GlassPanel>
        ) : (
          <GlassPanel className="grid h-full place-items-center p-10 text-center">
            <div className="flex flex-col items-center gap-3">
              <span className="grid h-14 w-14 place-items-center rounded-2xl bg-[linear-gradient(135deg,var(--accent-from),var(--accent-to))] text-white shadow-[0_12px_26px_-12px_var(--accent-glow)]">
                <PenTool size={26} />
              </span>
              <p className="max-w-xs text-fg-muted">
                {canEdit
                  ? 'Select a canvas to edit, or create one to start sketching this project.'
                  : 'Select a canvas to view.'}
              </p>
              {canEdit && (
                <GradientButton
                  leftIcon={<Plus size={16} />}
                  onClick={handleCreate}
                  isLoading={createCanvas.isPending}
                >
                  New canvas
                </GradientButton>
              )}
            </div>
          </GlassPanel>
        )}
      </section>
    </div>
  );
}

function CanvasListItem({
  canvas,
  active,
  onSelect,
}: {
  canvas: CanvasNoteSummary;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={active}
      className={cn(
        'w-full rounded-2xl border p-3 text-left transition-colors',
        active
          ? 'border-[var(--accent-from)]/60 bg-[var(--glass-fill)] shadow-[0_10px_24px_-18px_var(--accent-glow)]'
          : 'border-[var(--glass-border)] hover:bg-[var(--glass-fill)]',
      )}
    >
      <p className="truncate text-sm font-semibold text-fg">{canvas.title}</p>
      <p className="mt-0.5 truncate text-xs text-fg-subtle">{PAGE_LABELS[canvas.page_type]} page</p>
      <p className="mt-1 text-[0.7rem] text-fg-subtle">
        {formatDistanceToNow(new Date(canvas.updated_at), { addSuffix: true })}
      </p>
    </button>
  );
}
