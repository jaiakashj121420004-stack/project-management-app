import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import { AlertCircle, ArrowLeft, Check, Trash2 } from 'lucide-react';
import { Spinner } from '@/components/feedback/Spinner';
import type { PageType } from '@/lib/canvasPages';
import type { CanvasNote } from '@/types/database';
import { canvasTitleSchema } from './schemas';
import { useCanvas, useDeleteCanvas, useSaveCanvas } from './useCanvas';
import { useSceneHistory } from './history';
import {
  parseScene,
  createPlaceholderTextBox,
  topZ,
  type CanvasElementBase,
  type CanvasScene,
} from './elements';
import { CanvasStage } from './CanvasStage';
import { CanvasToolbar } from './CanvasToolbar';
import { ZOOM_STEP, clampScale, type Camera } from './constants';

/** One write per ~700ms of idle, matching the notes editor's autosave. */
const AUTOSAVE_DELAY = 700;

type SaveStatus = 'saved' | 'unsaved' | 'saving' | 'error';

interface CanvasEditorProps {
  noteId: string;
  projectId: string;
  /** Editors/owners can edit; viewers get a read-only, pan/zoom-only canvas. */
  canEdit: boolean;
  /** Return to the list (mobile) and after a delete. */
  onBack: () => void;
  onDeleted: () => void;
}

/** Loads the full canvas (with its scene) then hands a concrete note to the
 *  stateful editor, keyed by id so it re-seeds when the canvas changes. */
export function CanvasEditor({ noteId, projectId, canEdit, onBack, onDeleted }: CanvasEditorProps) {
  const { data: note, isLoading } = useCanvas(noteId);

  // Prefer any cached doc (incl. the optimistic one a just-created canvas seeds)
  // over the error state, so creating a canvas never flashes a load failure.
  if (!note) {
    return isLoading ? (
      <div className="grid h-full place-items-center py-24">
        <Spinner size={32} />
      </div>
    ) : (
      <div className="grid h-full place-items-center py-24 text-center text-fg-muted">
        Couldn&apos;t load this canvas. Check your connection and try again.
      </div>
    );
  }

  return (
    <CanvasEditorReady
      key={note.id}
      note={note}
      projectId={projectId}
      canEdit={canEdit}
      onBack={onBack}
      onDeleted={onDeleted}
    />
  );
}

function sceneEquals(a: CanvasScene, b: CanvasScene): boolean {
  return JSON.stringify(a.elements) === JSON.stringify(b.elements);
}

interface CanvasEditorReadyProps {
  note: CanvasNote;
  projectId: string;
  canEdit: boolean;
  onBack: () => void;
  onDeleted: () => void;
}

function CanvasEditorReady({
  note,
  projectId,
  canEdit,
  onBack,
  onDeleted,
}: CanvasEditorReadyProps) {
  const { mutate: runSave } = useSaveCanvas(projectId);
  const { mutate: runDelete } = useDeleteCanvas(projectId);

  // Seed scene/title/page-type once; the component is keyed by note id upstream.
  const [seedScene] = useState<CanvasScene>(() => parseScene(note.scene));
  const history = useSceneHistory(seedScene);
  const { scene, commit, undo, redo, canUndo, canRedo } = history;

  const [title, setTitle] = useState(note.title);
  const [pageType, setPageType] = useState<PageType>(note.page_type);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [camera, setCamera] = useState<Camera>({ x: 0, y: 0, scale: 1 });
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const centeredRef = useRef(false);

  const [saved, setSaved] = useState<{ scene: CanvasScene; pageType: PageType; title: string }>(
    () => ({ scene: seedScene, pageType: note.page_type, title: note.title }),
  );
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'error'>('idle');
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const titleParse = canvasTitleSchema.safeParse(title);
  const titleError = titleParse.success
    ? null
    : (titleParse.error.issues[0]?.message ?? 'Give the canvas a title.');
  const isDirty =
    pageType !== saved.pageType ||
    title.trim() !== saved.title ||
    !sceneEquals(scene, saved.scene);
  const status: SaveStatus =
    saveState === 'saving'
      ? 'saving'
      : saveState === 'error'
        ? 'error'
        : isDirty
          ? 'unsaved'
          : 'saved';

  // Resolve the selection against the live scene so a stale id (e.g. after undo
  // removes the selected element) simply reads as "nothing selected" — derived,
  // never stored, so no selection-clearing effect is needed.
  const selectedElement = selectedId
    ? scene.elements.find((el) => el.id === selectedId)
    : undefined;
  const effectiveSelectedId = selectedElement ? selectedId : null;

  // Build the patch for the changed fields, or null if nothing (valid) changed.
  const buildPatch = useCallback((): {
    title?: string;
    page_type?: PageType;
    scene?: CanvasScene;
  } | null => {
    const parsed = canvasTitleSchema.safeParse(title);
    if (!parsed.success) return null;
    const patch: { title?: string; page_type?: PageType; scene?: CanvasScene } = {};
    if (parsed.data !== saved.title) patch.title = parsed.data;
    if (pageType !== saved.pageType) patch.page_type = pageType;
    if (!sceneEquals(scene, saved.scene)) patch.scene = scene;
    return Object.keys(patch).length > 0 ? patch : null;
  }, [title, pageType, scene, saved]);

  // Debounced autosave (scene + page type + title).
  useEffect(() => {
    if (!canEdit) return;
    const patch = buildPatch();
    if (!patch) return;
    const timer = setTimeout(() => {
      setSaveState('saving');
      runSave(
        { id: note.id, ...patch },
        {
          onSuccess: (row) => {
            setSaved({
              scene: parseScene(row.scene),
              pageType: row.page_type,
              title: row.title,
            });
            setSaveState('idle');
          },
          onError: () => setSaveState('error'),
        },
      );
    }, AUTOSAVE_DELAY);
    return () => clearTimeout(timer);
  }, [buildPatch, note.id, runSave, canEdit]);

  // Flush an in-flight edit on unmount so switching canvases never drops it.
  const flushRef = useRef<() => void>(() => {});
  useEffect(() => {
    flushRef.current = () => {
      if (!canEdit) return;
      const patch = buildPatch();
      if (patch) runSave({ id: note.id, ...patch });
    };
  });
  useEffect(() => () => flushRef.current(), []);

  // --- element + camera actions ---------------------------------------------

  const handleViewportChange = useCallback((size: { width: number; height: number }) => {
    setViewport(size);
    if (!centeredRef.current && size.width > 0 && size.height > 0) {
      centeredRef.current = true;
      // Place the world origin at the viewport centre.
      setCamera({ x: size.width / 2, y: size.height / 2, scale: 1 });
    }
  }, []);

  const changeElement = useCallback(
    (id: string, patch: Partial<CanvasElementBase>) => {
      commit({ elements: scene.elements.map((el) => (el.id === id ? { ...el, ...patch } : el)) });
    },
    [commit, scene.elements],
  );

  function addPlaceholder() {
    const worldCx = (viewport.width / 2 - camera.x) / camera.scale;
    const worldCy = (viewport.height / 2 - camera.y) / camera.scale;
    const element = createPlaceholderTextBox(worldCx, worldCy, topZ(scene.elements));
    commit({ elements: [...scene.elements, element] });
    setSelectedId(element.id);
  }

  function deleteSelected() {
    if (!selectedId) return;
    commit({ elements: scene.elements.filter((el) => el.id !== selectedId) });
    setSelectedId(null);
  }

  function toggleLock() {
    if (!selectedId) return;
    commit({
      elements: scene.elements.map((el) =>
        el.id === selectedId ? { ...el, locked: !el.locked } : el,
      ),
    });
  }

  function zoomBy(factor: number) {
    setCamera((current) => {
      const scale = clampScale(current.scale * factor);
      const cx = viewport.width / 2;
      const cy = viewport.height / 2;
      const worldX = (cx - current.x) / current.scale;
      const worldY = (cy - current.y) / current.scale;
      return { scale, x: cx - worldX * scale, y: cy - worldY * scale };
    });
  }

  function resetZoom() {
    setCamera({ x: viewport.width / 2, y: viewport.height / 2, scale: 1 });
  }

  // Keyboard: undo/redo + delete. Bound once; reads the latest actions via a ref
  // so it never goes stale and never re-subscribes on every scene change.
  const actionsRef = useRef({ undo, redo, deleteSelected, hasSelection: false });
  useEffect(() => {
    actionsRef.current = { undo, redo, deleteSelected, hasSelection: Boolean(selectedElement) };
  });
  useEffect(() => {
    if (!canEdit) return;
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      ) {
        return;
      }
      const meta = event.ctrlKey || event.metaKey;
      if (meta && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) actionsRef.current.redo();
        else actionsRef.current.undo();
      } else if (meta && event.key.toLowerCase() === 'y') {
        event.preventDefault();
        actionsRef.current.redo();
      } else if (
        (event.key === 'Delete' || event.key === 'Backspace') &&
        actionsRef.current.hasSelection
      ) {
        event.preventDefault();
        actionsRef.current.deleteSelected();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [canEdit]);

  function handleDelete() {
    runDelete({ id: note.id });
    onDeleted();
  }

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to canvases"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-fg-muted transition-colors hover:bg-[var(--glass-fill)] hover:text-fg lg:hidden"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="min-w-0 flex-1">
            <input
              value={title}
              maxLength={120}
              readOnly={!canEdit}
              onChange={(event: ChangeEvent<HTMLInputElement>) => setTitle(event.target.value)}
              placeholder="Canvas title…"
              aria-label="Canvas title"
              className="w-full truncate bg-transparent font-display text-xl font-bold text-fg placeholder:text-fg-subtle focus:outline-none sm:text-2xl"
            />
            {canEdit && titleError && <p className="mt-1 text-xs text-danger">{titleError}</p>}
          </div>
        </div>

        {canEdit && (
          <div className="flex shrink-0 items-center gap-2">
            <SaveIndicator status={status} />
            <button
              type="button"
              aria-label="Delete canvas"
              onClick={() => setConfirmingDelete((open) => !open)}
              className="grid h-9 w-9 place-items-center rounded-xl text-fg-subtle transition-colors hover:bg-danger/10 hover:text-danger"
            >
              <Trash2 size={16} />
            </button>
          </div>
        )}
      </div>

      {confirmingDelete && canEdit && (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-fg-muted">
          <span>
            Delete <span className="font-semibold text-fg">{note.title}</span>? This can&apos;t be
            undone.
          </span>
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() => setConfirmingDelete(false)}
              className="rounded-lg px-2 py-1 text-xs font-medium text-fg-muted hover:bg-[var(--glass-fill)]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDelete}
              className="rounded-lg bg-danger/20 px-2 py-1 text-xs font-semibold text-danger hover:bg-danger/30"
            >
              Delete
            </button>
          </div>
        </div>
      )}

      <div className="relative h-[58vh] w-full sm:h-[66vh]">
        <div className="absolute inset-0">
          <CanvasStage
            elements={scene.elements}
            pageType={pageType}
            selectedId={effectiveSelectedId}
            camera={camera}
            tool="select"
            canEdit={canEdit}
            onSelect={setSelectedId}
            onChangeElement={changeElement}
            onCameraChange={setCamera}
            onViewportChange={handleViewportChange}
          />
        </div>
        <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center p-2 sm:p-3">
          <CanvasToolbar
            className="pointer-events-auto"
            canEdit={canEdit}
            pageType={pageType}
            onPageType={setPageType}
            scale={camera.scale}
            onZoomIn={() => zoomBy(ZOOM_STEP)}
            onZoomOut={() => zoomBy(1 / ZOOM_STEP)}
            onZoomReset={resetZoom}
            canUndo={canUndo}
            canRedo={canRedo}
            onUndo={undo}
            onRedo={redo}
            onAdd={addPlaceholder}
            hasSelection={Boolean(selectedElement)}
            selectedLocked={selectedElement?.locked ?? false}
            onToggleLock={toggleLock}
            onDeleteSelected={deleteSelected}
          />
        </div>
      </div>
    </div>
  );
}

/** A subtle, non-shouting indicator of the autosave state. */
function SaveIndicator({ status }: { status: SaveStatus }) {
  if (status === 'saving') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-fg-subtle">
        <Spinner size={12} className="text-current" /> Saving…
      </span>
    );
  }
  if (status === 'unsaved') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-fg-subtle">
        <span className="h-1.5 w-1.5 rounded-full bg-warning" /> Unsaved
      </span>
    );
  }
  if (status === 'error') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-danger">
        <AlertCircle size={13} /> Couldn&apos;t save
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-fg-subtle">
      <Check size={13} className="text-success" /> Saved
    </span>
  );
}
