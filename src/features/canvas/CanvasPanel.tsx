import { useMemo, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { PenTool, Plus } from 'lucide-react';
import { GlassPanel } from '@/components/glass/GlassPanel';
import { GradientButton } from '@/components/buttons/GradientButton';
import { Spinner } from '@/components/feedback/Spinner';
import { EntityPicker } from '@/components/forms/EntityPicker';
import { PAGE_LABELS } from '@/lib/canvasPages';
import type { CanvasNoteSummary } from './api';
import { useCanvasList, useCreateCanvas } from './useCanvas';
import { CanvasEditor } from './CanvasEditor';

const DEFAULT_TITLE = 'Untitled canvas';

/**
 * The per-project Canvas tab: a full-width header (a glass dropdown picker for
 * the active canvas, the count, and a New button) over the selected canvas at
 * full width on every breakpoint. The most-recently-edited canvas is selected by
 * default; deleting falls back to the next one. Access is membership/Pro-gated by
 * RLS — this component never filters by user. This module is lazy-loaded by
 * ProjectPage so Konva never ships to users who don't open a canvas.
 */
export function CanvasPanel({ projectId, canEdit }: { projectId: string; canEdit: boolean }) {
  const { data, isLoading, isError } = useCanvasList(projectId);
  const createCanvas = useCreateCanvas(projectId);

  const [selectedId, setSelectedId] = useState<string | null>(null);

  const canvases = useMemo(
    () =>
      [...(data ?? [])].sort(
        (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
      ),
    [data],
  );

  // The explicit choice if it still exists, else the most-recently edited canvas.
  // A deleted canvas simply falls back to the next one.
  const selected: CanvasNoteSummary | undefined =
    canvases.find((canvas) => canvas.id === selectedId) ?? canvases[0];

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
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {canvases.length > 0 && (
            <EntityPicker
              className="w-full max-w-[15rem] sm:max-w-[18rem]"
              label="Select a canvas"
              items={canvases.map((canvas) => ({
                id: canvas.id,
                title: canvas.title,
                subtitle: `${PAGE_LABELS[canvas.page_type]} page · ${formatDistanceToNow(
                  new Date(canvas.updated_at),
                  { addSuffix: true },
                )}`,
              }))}
              selectedId={selected?.id ?? null}
              onSelect={setSelectedId}
            />
          )}
          <span className="flex shrink-0 items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-fg-muted">
            <PenTool size={15} /> Canvas
            <span className="text-fg-subtle">· {canvases.length}</span>
          </span>
        </div>
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
        <GlassPanel className="grid min-h-[50vh] place-items-center p-10 text-center">
          <div className="flex flex-col items-center gap-3">
            <span className="grid h-14 w-14 place-items-center rounded-2xl bg-[linear-gradient(135deg,var(--accent-from),var(--accent-to))] text-white shadow-[0_12px_26px_-12px_var(--accent-glow)]">
              <PenTool size={26} />
            </span>
            <p className="max-w-xs text-fg-muted">
              {canEdit
                ? 'No canvases yet. Sketch ideas, pin notes, and lay things out freely.'
                : 'No canvases have been added to this project yet.'}
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
      ) : selected ? (
        <CanvasEditor
          key={selected.id}
          noteId={selected.id}
          projectId={projectId}
          canEdit={canEdit}
          onDeleted={() => setSelectedId(null)}
        />
      ) : null}
    </div>
  );
}
