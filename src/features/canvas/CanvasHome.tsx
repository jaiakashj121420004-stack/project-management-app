import { lazy, Suspense, useMemo, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { PenTool, Plus } from 'lucide-react';
import { GlassPanel } from '@/components/glass/GlassPanel';
import { GradientButton } from '@/components/buttons/GradientButton';
import { Spinner } from '@/components/feedback/Spinner';
import { Reveal } from '@/components/motion/Reveal';
import { EntityPicker } from '@/components/forms/EntityPicker';
import { useAuth } from '@/hooks/useAuth';
import { PAGE_LABELS } from '@/lib/canvasPages';
import { ProGate } from '@/features/billing';
import { useMyRole } from '@/features/members';
import { useAllCanvases, useCreateIndependentCanvas, type AggregatedCanvas } from './useCanvas';
import { canvasCreateErrorMessage } from './errors';

// The editor (Konva via CanvasStage) is lazy-loaded exactly like ProjectPage does
// for CanvasPanel, so CanvasHome stays Konva-free and the heavy chunk loads only
// when a canvas is actually opened. The barrel re-exports only this file.
const CanvasEditor = lazy(() =>
  import('./CanvasEditor').then((module) => ({ default: module.CanvasEditor })),
);

const DEFAULT_TITLE = 'Untitled canvas';

/**
 * The global /canvas destination — a real, full-width Canvas workspace (not a
 * project picker). The dropdown picker lists EVERY canvas the user can reach,
 * each labelled "Personal" or by its project name; "+ New" creates a personal
 * canvas; selecting any opens it inline in the full-width editor. Pro-gated on the
 * viewer's own plan (creating a personal canvas needs Pro) — the real gate is
 * RLS (user_is_pro / project_is_pro). Konva-free; the editor is lazy-loaded.
 */
export function CanvasHome() {
  return (
    <div className="flex flex-col gap-6">
      <Reveal>
        <header className="flex items-center gap-3 pt-2">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[linear-gradient(135deg,var(--accent-from),var(--accent-to))] text-white shadow-[0_10px_24px_-12px_var(--accent-glow)]">
            <PenTool size={22} />
          </span>
          <div>
            <h1 className="gradient-text text-2xl font-bold leading-tight">Canvas</h1>
            <p className="text-sm text-fg-muted">
              Sketch on a personal canvas, or open any of your project canvases.
            </p>
          </div>
        </header>
      </Reveal>

      <ProGate
        title="The Notes Canvas is a Pro feature"
        reason="Upgrade to Pro to sketch, lay out, and collaborate on an infinite whiteboard — personal or shared with a project."
      >
        <CanvasWorkspace />
      </ProGate>
    </div>
  );
}

/** The Pro-only inner workspace: picker + New + inline editor. Only rendered once
 *  ProGate confirms the viewer is on Pro, so its queries never run for free users. */
function CanvasWorkspace() {
  const { user } = useAuth();
  const { data: canvases, isLoading, isError } = useAllCanvases();
  const createCanvas = useCreateIndependentCanvas();

  const [selectedId, setSelectedId] = useState<string | null>(null);

  const sorted = useMemo<AggregatedCanvas[]>(
    () =>
      [...(canvases ?? [])].sort(
        (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
      ),
    [canvases],
  );

  // The explicit choice if it still exists, else the most-recently edited canvas.
  const selected = sorted.find((canvas) => canvas.id === selectedId) ?? sorted[0];

  // For a PROJECT canvas, edit rights follow the project role (disabled for a
  // personal canvas, where ownership is the only path). RLS is the real gate.
  const role = useMyRole(selected && selected.project_id ? selected.project_id : undefined);
  const canEdit = !selected
    ? false
    : selected.project_id === null
      ? selected.owner_id === user?.id
      : role !== 'viewer';

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
        Couldn&apos;t load your canvases. Check your connection and try again.
      </GlassPanel>
    );
  }

  if (sorted.length === 0) {
    return (
      <GlassPanel className="grid min-h-[50vh] place-items-center p-10 text-center">
        <div className="flex flex-col items-center gap-3">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-[linear-gradient(135deg,var(--accent-from),var(--accent-to))] text-white shadow-[0_12px_26px_-12px_var(--accent-glow)]">
            <PenTool size={26} />
          </span>
          <p className="max-w-xs text-fg-muted">
            No canvases yet. Create a personal canvas to sketch ideas, pin notes, and lay things out
            freely.
          </p>
          <GradientButton
            leftIcon={<Plus size={16} />}
            onClick={handleCreate}
            isLoading={createCanvas.isPending}
          >
            New canvas
          </GradientButton>
        </div>
      </GlassPanel>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <EntityPicker
            className="w-full max-w-[15rem] sm:max-w-[18rem]"
            label="Select a canvas"
            items={sorted.map((canvas) => ({
              id: canvas.id,
              title: canvas.title,
              subtitle: `${groupLabel(canvas)} · ${PAGE_LABELS[canvas.page_type]} page · ${formatDistanceToNow(
                new Date(canvas.updated_at),
                { addSuffix: true },
              )}`,
            }))}
            selectedId={selected?.id ?? null}
            onSelect={setSelectedId}
          />
          <span className="flex shrink-0 items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-fg-muted">
            <PenTool size={15} /> Canvas
            <span className="text-fg-subtle">· {sorted.length}</span>
          </span>
        </div>
        <GradientButton
          size="sm"
          leftIcon={<Plus size={15} />}
          onClick={handleCreate}
          isLoading={createCanvas.isPending}
        >
          New
        </GradientButton>
      </div>

      {createCanvas.isError && (
        <div
          role="alert"
          className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-fg-muted"
        >
          {canvasCreateErrorMessage(createCanvas.error)}
        </div>
      )}

      {selected && (
        <Suspense
          fallback={
            <div className="grid place-items-center py-24">
              <Spinner size={32} />
            </div>
          }
        >
          <CanvasEditor
            key={selected.id}
            noteId={selected.id}
            projectId={selected.project_id}
            canEdit={canEdit}
            onDeleted={() => setSelectedId(null)}
          />
        </Suspense>
      )}
    </div>
  );
}

/** The picker group label: a personal canvas reads "Personal", a project canvas
 *  reads its project name (or a neutral fallback if it isn't in the cache yet). */
function groupLabel(canvas: AggregatedCanvas): string {
  if (canvas.project_id === null) return 'Personal';
  return canvas.projectName ?? 'Project';
}
