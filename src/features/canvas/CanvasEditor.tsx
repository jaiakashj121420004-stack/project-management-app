import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { AlertCircle, Check, Eye, Pencil, Trash2, X } from 'lucide-react';
import { Spinner } from '@/components/feedback/Spinner';
import { SegmentedToggle } from '@/components/forms/SegmentedToggle';
import { useTheme } from '@/hooks/useTheme';
import { PAGE_PATTERN_SPACING, type PageType } from '@/lib/canvasPages';
import { MEDIA_CAPS } from '@/lib/proFeatures';
import { MediaUploadError, uploadCanvasMedia } from '@/lib/storage';
import type { CanvasNote } from '@/types/database';
import { canvasTitleSchema } from './schemas';
import { useCanvas, useDeleteCanvas, useSaveCanvas } from './useCanvas';
import { useSceneHistory } from './history';
import {
  parseScene,
  createPlaceholderTextBox,
  createTextBoxAt,
  createImageElement,
  topZ,
  type CanvasScene,
  type ElementPatch,
} from './elements';
import { buildStroke, type StrokeStyle } from './freehand';
import { defaultPenSettings, type PenSettings } from './drawing';
import { CanvasStage } from './CanvasStage';
import { CanvasToolbar } from './CanvasToolbar';
import { PenToolbar } from './PenToolbar';
import { ZOOM_STEP, clampScale, type Camera, type CanvasTool } from './constants';
import './canvasText.css';

// ---------------------------------------------------------------------------
// Image upload helpers (canvas-editor-local, not exported)
// ---------------------------------------------------------------------------

/** Accept string for the hidden file input — mirrors MEDIA_CAPS.image.mimeTypes. */
const IMAGE_ACCEPT = MEDIA_CAPS.image.mimeTypes.join(',');

/**
 * Read a File's natural pixel dimensions before uploading it. We create an
 * object URL, load it into a temporary Image, then revoke. Falls back to a
 * sensible 400×300 default on error so the upload is never blocked.
 */
function getFileDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      const MAX_W = 600;
      const ratio = img.naturalWidth > 0 ? img.naturalWidth / img.naturalHeight : 4 / 3;
      const width = Math.min(MAX_W, img.naturalWidth || MAX_W);
      const height = Math.max(1, Math.round(width / ratio));
      URL.revokeObjectURL(objectUrl);
      resolve({ width, height });
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve({ width: 400, height: 300 });
    };
    img.src = objectUrl;
  });
}

/** One write per ~700ms of idle, matching the notes editor's autosave. */
const AUTOSAVE_DELAY = 700;

type SaveStatus = 'saved' | 'unsaved' | 'saving' | 'error';

interface CanvasEditorProps {
  noteId: string;
  /** The canvas's project, or null for a personal canvas (drives which list
   *  caches save/delete reconcile). */
  projectId: string | null;
  /** Editors/owners can edit; viewers get a read-only, pan/zoom-only canvas. */
  canEdit: boolean;
  /** Clear the parent's selection after a delete (falls back to the next one). */
  onDeleted: () => void;
}

/** Loads the full canvas (with its scene) then hands a concrete note to the
 *  stateful editor, keyed by id so it re-seeds when the canvas changes. */
export function CanvasEditor({ noteId, projectId, canEdit, onDeleted }: CanvasEditorProps) {
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
      onDeleted={onDeleted}
    />
  );
}

function sceneEquals(a: CanvasScene, b: CanvasScene): boolean {
  return JSON.stringify(a.elements) === JSON.stringify(b.elements);
}

interface CanvasEditorReadyProps {
  note: CanvasNote;
  projectId: string | null;
  canEdit: boolean;
  onDeleted: () => void;
}

function CanvasEditorReady({ note, projectId, canEdit, onDeleted }: CanvasEditorReadyProps) {
  const { mutate: runSave } = useSaveCanvas(projectId);
  const { mutate: runDelete } = useDeleteCanvas(projectId);
  const { theme } = useTheme();

  // Image upload state.
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Seed scene/title/page-type once; the component is keyed by note id upstream.
  const [seedScene] = useState<CanvasScene>(() => parseScene(note.scene));
  const history = useSceneHistory(seedScene);
  const { scene, commit, undo, redo, canUndo, canRedo } = history;

  const [title, setTitle] = useState(note.title);
  const [pageType, setPageType] = useState<PageType>(note.page_type);
  // Editors can flip to a read-only View; viewers are always read-only. The
  // stage + toolbar key all their editing affordances off `editing`.
  const [mode, setMode] = useState<'edit' | 'view'>('edit');
  const editing = canEdit && mode === 'edit';
  const [tool, setTool] = useState<CanvasTool>('select');
  const [pen, setPen] = useState<PenSettings>(() => defaultPenSettings(theme));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // The text box open for inline rich-text editing (null = none).
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [camera, setCamera] = useState<Camera>({ x: 0, y: 0, scale: 1 });
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const centeredRef = useRef(false);

  // The eraser hides strokes live while dragging, then commits the whole batch as
  // one undo step on release. We keep the latest set in a ref so the release
  // handler reads it without re-subscribing.
  const [erasingIds, setErasingIds] = useState<ReadonlySet<string>>(() => new Set());
  const erasingRef = useRef<ReadonlySet<string>>(erasingIds);
  useEffect(() => {
    erasingRef.current = erasingIds;
  }, [erasingIds]);

  // Only the select tool is active outside edit mode (viewers / View mode).
  const effectiveTool: CanvasTool = editing ? tool : 'select';
  const visibleElements = useMemo(
    () =>
      erasingIds.size === 0
        ? scene.elements
        : scene.elements.filter((el) => !erasingIds.has(el.id)),
    [scene.elements, erasingIds],
  );

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

  // Edit a text box only while it still exists, is unlocked, and we're in edit
  // mode — derived (never stored), mirroring effectiveSelectedId, so a removed /
  // locked box or a flip to View simply reads as "not editing", no effect needed.
  const editingElement = editingTextId
    ? scene.elements.find((el) => el.id === editingTextId)
    : undefined;
  const effectiveEditingId =
    editing && editingElement && !editingElement.locked ? editingTextId : null;

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
    (id: string, patch: ElementPatch) => {
      commit({
        elements: scene.elements.map((el) => (el.id === id ? { ...el, ...patch } : el)),
      });
    },
    [commit, scene.elements],
  );

  // A finished freehand gesture → a first-class Stroke element on top of the scene.
  const commitStroke = useCallback(
    (worldPoints: number[], style: StrokeStyle) => {
      const stroke = buildStroke(worldPoints, style, scene.elements);
      if (stroke) commit({ elements: [...scene.elements, stroke] });
    },
    [commit, scene.elements],
  );

  // Erase: hide each touched element live; commit the batch on release. Works on
  // any element type (strokes, text, …) so the eraser "just removes" what it
  // touches; one undo restores the whole batch.
  const eraseStroke = useCallback(
    (id: string) => {
      const el = scene.elements.find((element) => element.id === id);
      if (!el) return;
      setErasingIds((prev) => {
        if (prev.has(id)) return prev;
        const next = new Set(prev);
        next.add(id);
        return next;
      });
    },
    [scene.elements],
  );

  const endErase = useCallback(() => {
    const ids = erasingRef.current;
    if (ids.size === 0) return;
    commit({ elements: scene.elements.filter((el) => !ids.has(el.id)) });
    setErasingIds(new Set());
  }, [commit, scene.elements]);

  // Switching away from select clears the selection (no stray transformer) and
  // always ends any text edit.
  const changeTool = useCallback((next: CanvasTool) => {
    setTool(next);
    setEditingTextId(null);
    if (next !== 'select') setSelectedId(null);
  }, []);

  // Selecting an element (click/tap via the stage) ends any open text edit — the
  // editing box itself swallows its own clicks, so this only fires for OTHER
  // elements or an empty-canvas click.
  const selectElement = useCallback((id: string | null) => {
    setSelectedId(id);
    setEditingTextId(null);
  }, []);

  // Double-click a text box → select + open it for inline editing.
  const editText = useCallback((id: string) => {
    setSelectedId(id);
    setEditingTextId(id);
  }, []);

  const endTextEdit = useCallback(() => setEditingTextId(null), []);

  function addText() {
    const worldCx = (viewport.width / 2 - camera.x) / camera.scale;
    const worldCy = (viewport.height / 2 - camera.y) / camera.scale;
    const element = createPlaceholderTextBox(worldCx, worldCy, topZ(scene.elements));
    commit({ elements: [...scene.elements, element] });
    // Open the new box straight into edit mode so the user can just start typing.
    setTool('select');
    setSelectedId(element.id);
    setEditingTextId(element.id);
  }

  // Text tool: drop a box where the user clicked and open it for typing. On a
  // ruled page, snap the top edge to a rule line so the text sits on the lines.
  const placeText = useCallback(
    (worldX: number, worldY: number) => {
      const y =
        pageType === 'ruled'
          ? Math.round(worldY / PAGE_PATTERN_SPACING) * PAGE_PATTERN_SPACING
          : worldY;
      const element = createTextBoxAt(worldX, y, topZ(scene.elements));
      commit({ elements: [...scene.elements, element] });
      setTool('select');
      setSelectedId(element.id);
      setEditingTextId(element.id);
    },
    [commit, scene.elements, pageType],
  );

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

  // --- image upload ----------------------------------------------------------

  /**
   * Upload a single image file to canvas-media, then place an ImageElement at
   * (`worldX`, `worldY`) — or at the viewport centre when coordinates are
   * omitted (file picker / paste paths).
   */
  async function handleImageFile(file: File, worldX?: number, worldY?: number) {
    // Personal canvases (projectId === null) cannot use the canvas-media bucket
    // with the current Storage RLS, which is keyed by projectId. Skip silently —
    // the toolbar button is hidden for personal canvases anyway.
    if (!projectId) return;
    setUploadError(null);
    setIsUploading(true);
    try {
      const [dims, { path }] = await Promise.all([
        getFileDimensions(file),
        uploadCanvasMedia(projectId, note.id, file),
      ]);
      const cx = worldX ?? (viewport.width / 2 - camera.x) / camera.scale;
      const cy = worldY ?? (viewport.height / 2 - camera.y) / camera.scale;
      const element = createImageElement(
        cx - dims.width / 2,
        cy - dims.height / 2,
        topZ(scene.elements),
        path,
        dims.width,
        dims.height,
      );
      commit({ elements: [...scene.elements, element] });
      setSelectedId(element.id);
    } catch (err) {
      const msg =
        err instanceof MediaUploadError
          ? err.message
          : 'Something went wrong uploading the image. Please try again.';
      setUploadError(msg);
    } finally {
      setIsUploading(false);
    }
  }

  /** Open the OS file picker (accepts images only). */
  function addImage() {
    if (!projectId) return; // hidden for personal canvases
    fileInputRef.current?.click();
  }

  function handleFileInputChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Reset so re-selecting the same file fires the event again.
    e.target.value = '';
    if (file) void handleImageFile(file);
  }

  /**
   * Handle paste from clipboard — picks the first image item if one exists.
   * Text items are ignored so normal copy-paste in text boxes still works when
   * the user isn't inside the Tiptap editor (the outer div captures first).
   */
  function handlePaste(e: React.ClipboardEvent<HTMLDivElement>) {
    if (!editing || !projectId) return;
    // If a text box is being edited, let the event fall through to Tiptap.
    if (editingTextId !== null) return;
    const items = Array.from(e.clipboardData.items);
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          void handleImageFile(file);
          break;
        }
      }
    }
  }

  /** Called by CanvasStage when the user drops files onto the Konva surface. */
  function handleDropFiles(worldX: number, worldY: number, files: File[]) {
    if (!editing || !projectId) return;
    const file = files[0];
    if (file) void handleImageFile(file, worldX, worldY);
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
  const actionsRef = useRef({ undo, redo, deleteSelected, changeTool, hasSelection: false });
  useEffect(() => {
    actionsRef.current = {
      undo,
      redo,
      deleteSelected,
      changeTool,
      hasSelection: Boolean(selectedElement),
    };
  });
  useEffect(() => {
    if (!editing) return;
    function onKeyDown(event: KeyboardEvent) {
      // While a text box is open, ALL canvas shortcuts are off — every keystroke
      // belongs to the editor (a stray 'e'/'p'/'v' must never switch tools and
      // close the box, which looked like "typing vanishes").
      if (editingTextId !== null) return;
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
      } else if (meta) {
        return;
      } else if (
        (event.key === 'Delete' || event.key === 'Backspace') &&
        actionsRef.current.hasSelection
      ) {
        event.preventDefault();
        actionsRef.current.deleteSelected();
      } else if (event.key === 'v' || event.key === 'V') {
        actionsRef.current.changeTool('select');
      } else if (event.key === 'p' || event.key === 'P' || event.key === 'b' || event.key === 'B') {
        actionsRef.current.changeTool('draw');
      } else if (event.key === 'e' || event.key === 'E') {
        actionsRef.current.changeTool('erase');
      } else if (event.key === 't' || event.key === 'T') {
        actionsRef.current.changeTool('text');
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [editing, editingTextId]);

  function handleDelete() {
    runDelete({ id: note.id });
    onDeleted();
  }

  return (
    <div className="flex flex-col gap-3" onPaste={handlePaste}>
      {/* Hidden file input — triggered by the toolbar's "Add image" button. */}
      <input
        ref={fileInputRef}
        type="file"
        accept={IMAGE_ACCEPT}
        aria-hidden
        tabIndex={-1}
        className="sr-only"
        onChange={handleFileInputChange}
      />

      <div className="flex items-start justify-between gap-3">
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

        {canEdit && (
          <div className="flex shrink-0 items-center gap-2">
            {isUploading && (
              <span className="inline-flex items-center gap-1.5 text-xs text-fg-subtle">
                <Spinner size={12} className="text-current" /> Uploading…
              </span>
            )}
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

      {/* Image upload error — dismissible inline alert. */}
      {uploadError && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger"
        >
          <AlertCircle size={15} className="mt-0.5 shrink-0" />
          <span className="min-w-0 flex-1">{uploadError}</span>
          <button
            type="button"
            aria-label="Dismiss error"
            onClick={() => setUploadError(null)}
            className="shrink-0 rounded p-0.5 hover:bg-danger/20"
          >
            <X size={13} />
          </button>
        </div>
      )}

      {/* Edit / View toggle on every breakpoint — View renders the stage
          read-only (pan/zoom only). Viewers are always read-only (no toggle). */}
      {canEdit && (
        <SegmentedToggle
          label="Canvas mode"
          value={mode}
          onChange={(next) => {
            setMode(next);
            setEditingTextId(null);
          }}
          options={[
            { value: 'edit', label: 'Edit', icon: <Pencil size={14} /> },
            { value: 'view', label: 'View', icon: <Eye size={14} /> },
          ]}
        />
      )}

      <div className="relative min-h-[75vh] w-full flex-1">
        <div className="absolute inset-0">
          <CanvasStage
            elements={visibleElements}
            pageType={pageType}
            selectedId={effectiveSelectedId}
            camera={camera}
            tool={effectiveTool}
            canEdit={editing}
            penSettings={pen}
            editingTextId={effectiveEditingId}
            onSelect={selectElement}
            onChangeElement={changeElement}
            onCameraChange={setCamera}
            onViewportChange={handleViewportChange}
            onCommitStroke={commitStroke}
            onEraseStroke={eraseStroke}
            onEraseEnd={endErase}
            onPlaceText={placeText}
            onEditText={editText}
            onEndTextEdit={endTextEdit}
            onDropFiles={editing && projectId !== null ? handleDropFiles : undefined}
          />
        </div>
        <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-col items-center gap-2 p-2 sm:p-3">
          <CanvasToolbar
            className="pointer-events-auto"
            canEdit={editing}
            tool={tool}
            onTool={changeTool}
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
            onAdd={addText}
            onAddImage={projectId !== null ? addImage : undefined}
            hasSelection={Boolean(selectedElement)}
            selectedLocked={selectedElement?.locked ?? false}
            onToggleLock={toggleLock}
            onDeleteSelected={deleteSelected}
          />
          {editing && tool === 'draw' && (
            <PenToolbar className="pointer-events-auto" settings={pen} onChange={setPen} />
          )}
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
