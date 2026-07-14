import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from 'react';
import { AlertCircle, Check, Eye, Pencil, Trash2, X } from 'lucide-react';
import { Spinner } from '@/components/feedback/Spinner';
import { SegmentedToggle } from '@/components/forms/SegmentedToggle';
import { CanvasMinimap } from './CanvasMinimap';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/features/auth/useProfile';
import { useIsPro } from '@/features/billing';
import { useProjectIsPro } from '@/features/collaboration';
import { PAGE_PATTERN_SPACING, type PageType } from '@/lib/canvasPages';
import { MEDIA_CAPS, mediaKindForMime } from '@/lib/proFeatures';
import { MediaUploadError, uploadCanvasMedia } from '@/lib/storage';
import type { CanvasNote } from '@/types/database';
import { canvasTitleSchema } from './schemas';
import { useCanvas, useDeleteCanvas, useSaveCanvas } from './useCanvas';
import { useYjsCanvas } from './collab/useYjsCanvas';
import { cursorColor, type CanvasUser } from './collab/awareness';
import {
  parseScene,
  createPlaceholderTextBox,
  createTextBoxAt,
  createPageTextAt,
  createImageElement,
  createMediaFileElement,
  createMediaEmbedElement,
  bringToFront,
  bringForward,
  sendBackward,
  sendToBack,
  duplicateElements,
  topZ,
  type CanvasElement,
  type CanvasScene,
  type ElementPatch,
} from './elements';
import type { ParsedEmbed } from './embeds';
import { buildStroke, erasePartialStroke, type ErasePoint, type StrokeStyle } from './freehand';
import { defaultPenSettings, type PenSettings } from './drawing';
import { CanvasStage } from './CanvasStage';
import { CanvasToolbar } from './CanvasToolbar';
import { ContextMenu } from './ContextMenu';
import { LayersPanel } from './LayersPanel';
import { centerCamera } from './bounds';
import { PenToolbar } from './PenToolbar';
import { EraserToolbar } from './EraserToolbar';
import {
  NUDGE_STEP,
  NUDGE_LARGE_STEP,
  ZOOM_STEP,
  ERASER_DEFAULT_SIZE,
  clampScale,
  type Camera,
  type CanvasTool,
  type EraserMode,
} from './constants';
import './canvasText.css';

// The add-media modal pulls in the MediaRecorder/getUserMedia machinery; load it
// lazily so none of that ships in the canvas chunk until the user opens it.
const AddMediaModal = lazy(() =>
  import('./AddMediaModal').then((m) => ({ default: m.AddMediaModal })),
);

/** Default element sizes for newly placed media (world px). */
const AUDIO_SIZE = { width: 320, height: 64 };
const VIDEO_SIZE = { width: 480, height: 270 };

/**
 * Read an uploaded video's natural dimensions (capped) so it lands at the right
 * aspect ratio. Falls back to the 16:9 default on error so the upload is never
 * blocked.
 */
function getVideoDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      const MAX_W = 600;
      const ratio = video.videoWidth > 0 ? video.videoWidth / video.videoHeight : 16 / 9;
      const width = Math.min(MAX_W, video.videoWidth || MAX_W);
      const height = Math.max(1, Math.round(width / ratio));
      URL.revokeObjectURL(objectUrl);
      resolve({ width, height });
    };
    video.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(VIDEO_SIZE);
    };
    video.src = objectUrl;
  });
}

// ---------------------------------------------------------------------------
// Image upload helpers
// ---------------------------------------------------------------------------

/** Accept string for the hidden file input — mirrors MEDIA_CAPS.image.mimeTypes. */
const IMAGE_ACCEPT = MEDIA_CAPS.image.mimeTypes.join(',');

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
  projectId: string | null;
  canEdit: boolean;
  onDeleted: () => void;
}

export function CanvasEditor({ noteId, projectId, canEdit, onDeleted }: CanvasEditorProps) {
  const { data: note, isLoading } = useCanvas(noteId);

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

  // Image/media upload state.
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mediaModalOpen, setMediaModalOpen] = useState(false);

  // ── identity + realtime gating ───────────────────────────────────────────────
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const isPro = useIsPro();
  const { data: isProBoard } = useProjectIsPro(projectId ?? undefined);

  const me = useMemo<CanvasUser | null>(() => {
    if (!user) return null;
    const name = profile?.display_name?.trim() || user.email?.split('@')[0] || 'You';
    return { id: user.id, name, color: cursorColor(user.id), avatarUrl: profile?.avatar_url ?? null };
  }, [user, profile?.display_name, profile?.avatar_url]);

  // Join the live channel only for a Pro canvas: the board owner's plan governs a
  // project canvas; the owner's own plan a personal one. A shared member of a
  // personal canvas joins too (the channel's RLS is the real gate either way).
  const isOwner = note.owner_id === user?.id;
  const realtimeEnabled =
    Boolean(me) && (projectId ? Boolean(isProBoard) : isOwner ? isPro : true);

  // ── collaborative document (replaces the old local useSceneHistory) ──────────
  const {
    scene,
    commit,
    undo,
    redo,
    canUndo,
    canRedo,
    pageType,
    setPageType,
    encodeStateHex,
    fragmentFor,
    syncTextBody,
    syncElementLayout,
    caretProvider,
    remotePeers,
    setLocalCursor,
    setLocalSelection,
  } = useYjsCanvas({ note, realtimeEnabled, me });

  const caretUser = useMemo(
    () => ({ name: me?.name ?? 'You', color: me?.color ?? '#7C3AED' }),
    [me],
  );

  const [title, setTitle] = useState(note.title);
  const [mode, setMode] = useState<'edit' | 'view'>('edit');
  const editing = canEdit && mode === 'edit';
  const [tool, setTool] = useState<CanvasTool>('select');
  const [pen, setPen] = useState<PenSettings>(() => defaultPenSettings(theme));
  const [eraserMode, setEraserMode] = useState<EraserMode>('object');
  const [eraserSize, setEraserSize] = useState(ERASER_DEFAULT_SIZE);

  // Multi-select: array of selected element ids.
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  // Element clipboard (copy/paste).
  const [clipboard, setClipboard] = useState<CanvasElement[]>([]);
  // Context menu state.
  const [contextMenu, setContextMenu] = useState<{
    x: number; y: number; elementId: string | null;
  } | null>(null);
  // Layers panel visibility.
  const [showLayers, setShowLayers] = useState(false);

  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [camera, setCamera] = useState<Camera>({ x: 0, y: 0, scale: 1 });
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const centeredRef = useRef(false);

  // Eraser: hide live during gesture, commit on release.
  const [erasingIds, setErasingIds] = useState<ReadonlySet<string>>(() => new Set());
  const erasingRef = useRef<ReadonlySet<string>>(erasingIds);
  useEffect(() => { erasingRef.current = erasingIds; }, [erasingIds]);

  const effectiveTool: CanvasTool = editing ? tool : 'select';
  const visibleElements = useMemo(
    () =>
      erasingIds.size === 0
        ? scene.elements
        : scene.elements.filter((el) => !erasingIds.has(el.id)),
    [scene.elements, erasingIds],
  );

  const [saved, setSaved] = useState<{ scene: CanvasScene; pageType: PageType; title: string }>(
    () => ({ scene, pageType, title: note.title }),
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

  // Keep a ref to the latest elements so batched changeElement can always apply
  // against the newest state without depending on a stale closure over scene.elements.
  const sceneElementsRef = useRef(scene.elements);
  useEffect(() => { sceneElementsRef.current = scene.elements; }, [scene.elements]);

  // Filter selectedIds to only those that still exist in the scene.
  const validSelectedIds = useMemo(
    () => selectedIds.filter((id) => scene.elements.some((el) => el.id === id)),
    [selectedIds, scene.elements],
  );

  const primaryElement = validSelectedIds[0]
    ? scene.elements.find((el) => el.id === validSelectedIds[0])
    : undefined;

  // Publish the local selection to collaborators (drives their selection halos).
  const selectionKey = validSelectedIds.join(',');
  useEffect(() => {
    setLocalSelection(validSelectedIds);
    // selectionKey captures the meaningful change; validSelectedIds identity churns.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectionKey, setLocalSelection]);

  // Text-edit mode: only when editing, element exists, and isn't locked.
  const editingElementRaw = editingTextId
    ? scene.elements.find((el) => el.id === editingTextId)
    : undefined;
  const effectiveEditingId =
    editing && editingElementRaw && !editingElementRaw.locked ? editingTextId : null;

  // ── batched changeElement ────────────────────────────────────────────────────
  // Multiple calls within the same JS microtask (e.g. Transformer firing once
  // per selected node on transformend) are coalesced into a single commit so
  // they appear as one undo step.

  const pendingPatches = useRef(new Map<string, ElementPatch>());
  const batchTimer = useRef<number | null>(null);

  const changeElement = useCallback(
    (id: string, patch: ElementPatch) => {
      const existing = pendingPatches.current.get(id) ?? {};
      pendingPatches.current.set(id, { ...existing, ...patch });
      if (batchTimer.current !== null) return;
      batchTimer.current = window.setTimeout(() => {
        batchTimer.current = null;
        const patches = pendingPatches.current;
        pendingPatches.current = new Map();
        const updated = sceneElementsRef.current.map((el) => {
          const p = patches.get(el.id);
          return p ? { ...el, ...p } : el;
        });
        commit({ elements: updated });
      }, 0);
    },
    [commit],
  );

  // ── group move (from CanvasStage multi-drag) ─────────────────────────────────

  const handleGroupMove = useCallback(
    (moves: Array<{ id: string; x: number; y: number }>) => {
      const moveMap = new Map(moves.map((m) => [m.id, { x: m.x, y: m.y }]));
      commit({
        elements: sceneElementsRef.current.map((el) => {
          const m = moveMap.get(el.id);
          return m ? { ...el, ...m } : el;
        }),
      });
    },
    [commit],
  );

  const buildPatch = useCallback((): {
    title?: string;
    page_type?: PageType;
    scene?: CanvasScene;
    doc_state?: string;
  } | null => {
    const parsed = canvasTitleSchema.safeParse(title);
    if (!parsed.success) return null;
    const patch: {
      title?: string;
      page_type?: PageType;
      scene?: CanvasScene;
      doc_state?: string;
    } = {};
    if (parsed.data !== saved.title) patch.title = parsed.data;
    if (pageType !== saved.pageType) patch.page_type = pageType;
    if (!sceneEquals(scene, saved.scene)) {
      // The denormalised scene jsonb (fast non-realtime reads/thumbnails) AND the
      // authoritative Yjs binary snapshot are persisted together; Yjs merges make
      // last-write safe even with several editors saving concurrently.
      patch.scene = scene;
      patch.doc_state = encodeStateHex();
    }
    return Object.keys(patch).length > 0 ? patch : null;
  }, [title, pageType, scene, saved, encodeStateHex]);

  // Debounced autosave.
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

  const flushRef = useRef<() => void>(() => {});
  useEffect(() => {
    flushRef.current = () => {
      if (!canEdit) return;
      const patch = buildPatch();
      if (patch) runSave({ id: note.id, ...patch });
    };
  });
  useEffect(() => () => flushRef.current(), []);

  // ── viewport / camera ────────────────────────────────────────────────────────

  const handleViewportChange = useCallback((size: { width: number; height: number }) => {
    setViewport(size);
    if (!centeredRef.current && size.width > 0 && size.height > 0) {
      centeredRef.current = true;
      setCamera({ x: size.width / 2, y: size.height / 2, scale: 1 });
    }
  }, []);

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

  // ── stroke / erase ───────────────────────────────────────────────────────────

  const commitStroke = useCallback(
    (worldPoints: number[], style: StrokeStyle) => {
      const stroke = buildStroke(worldPoints, style, scene.elements);
      if (stroke) commit({ elements: [...scene.elements, stroke] });
    },
    [commit, scene.elements],
  );

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

  // Precision eraser: split each stroke the nib passed over into surviving
  // pieces (keeping their original z), committed as one undo step.
  const handlePrecisionErase = useCallback(
    (path: ErasePoint[], radius: number) => {
      const elements = sceneElementsRef.current;
      let changed = false;
      const next: CanvasElement[] = [];
      for (const el of elements) {
        if (el.type === 'stroke') {
          const pieces = erasePartialStroke(el, path, radius, elements);
          if (pieces !== null) {
            changed = true;
            for (const piece of pieces) next.push({ ...piece, z: el.z });
            continue;
          }
        }
        next.push(el);
      }
      if (changed) commit({ elements: next });
    },
    [commit],
  );

  // ── tool / selection / text edit ─────────────────────────────────────────────

  const changeTool = useCallback((next: CanvasTool) => {
    setTool(next);
    setEditingTextId(null);
    if (next !== 'select') setSelectedIds([]);
  }, []);

  const selectElements = useCallback((ids: string[]) => {
    setSelectedIds(ids);
    setEditingTextId(null);
  }, []);

  const editText = useCallback((id: string) => {
    setSelectedIds([id]);
    setEditingTextId(id);
  }, []);

  const endTextEdit = useCallback(() => setEditingTextId(null), []);

  // ── element actions ──────────────────────────────────────────────────────────

  /** Snap a world-Y to the nearest ruled line (so text sits on the rules). */
  function snapRuledY(worldY: number): number {
    return pageType === 'ruled'
      ? Math.round(worldY / PAGE_PATTERN_SPACING) * PAGE_PATTERN_SPACING
      : worldY;
  }

  function addText() {
    const worldCx = (viewport.width / 2 - camera.x) / camera.scale;
    const worldCy = snapRuledY((viewport.height / 2 - camera.y) / camera.scale);
    const element = createPlaceholderTextBox(worldCx, worldCy, topZ(scene.elements));
    commit({ elements: [...scene.elements, element] });
    setTool('select');
    setSelectedIds([element.id]);
    setEditingTextId(element.id);
  }

  /** Drop a document-width writing column near the top-left of the view and start
   *  typing — Google-Docs-style long-form writing on the canvas. */
  function addPageText() {
    const left = (24 - camera.x) / camera.scale;
    const top = snapRuledY((24 - camera.y) / camera.scale);
    const element = createPageTextAt(left, top, topZ(scene.elements));
    commit({ elements: [...scene.elements, element] });
    setTool('select');
    setSelectedIds([element.id]);
    setEditingTextId(element.id);
  }

  // Persist a text box's auto-grown height without an undo step.
  const handleTextResize = useCallback(
    (id: string, height: number) => {
      const el = sceneElementsRef.current.find((e) => e.id === id);
      if (el && Math.abs(el.height - height) > 0.5) syncElementLayout(id, { height });
    },
    [syncElementLayout],
  );

  const placeText = useCallback(
    (worldX: number, worldY: number) => {
      const y =
        pageType === 'ruled'
          ? Math.round(worldY / PAGE_PATTERN_SPACING) * PAGE_PATTERN_SPACING
          : worldY;
      const element = createTextBoxAt(worldX, y, topZ(scene.elements));
      commit({ elements: [...scene.elements, element] });
      setTool('select');
      setSelectedIds([element.id]);
      setEditingTextId(element.id);
    },
    [commit, scene.elements, pageType],
  );

  function deleteSelected() {
    if (!validSelectedIds.length) return;
    const idSet = new Set(validSelectedIds);
    commit({ elements: scene.elements.filter((el) => !idSet.has(el.id)) });
    setSelectedIds([]);
  }

  function toggleLock() {
    if (!validSelectedIds.length) return;
    const idSet = new Set(validSelectedIds);
    // Flip based on the primary element's current lock state.
    const targetLocked = !(primaryElement?.locked ?? false);
    commit({
      elements: scene.elements.map((el) =>
        idSet.has(el.id) ? { ...el, locked: targetLocked } : el,
      ),
    });
  }

  function toggleVisibility(id: string) {
    commit({
      elements: scene.elements.map((el) =>
        el.id === id ? { ...el, visible: el.visible === false ? true : false } : el,
      ),
    });
  }

  // ── z-order ──────────────────────────────────────────────────────────────────

  function bringToFrontAction() {
    if (!validSelectedIds.length) return;
    commit({ elements: bringToFront(scene.elements, new Set(validSelectedIds)) });
  }
  function bringForwardAction() {
    if (!validSelectedIds.length) return;
    commit({ elements: bringForward(scene.elements, new Set(validSelectedIds)) });
  }
  function sendBackwardAction() {
    if (!validSelectedIds.length) return;
    commit({ elements: sendBackward(scene.elements, new Set(validSelectedIds)) });
  }
  function sendToBackAction() {
    if (!validSelectedIds.length) return;
    commit({ elements: sendToBack(scene.elements, new Set(validSelectedIds)) });
  }

  // ── copy / paste / duplicate ─────────────────────────────────────────────────

  const copySelected = useCallback(() => {
    const copies = scene.elements.filter((el) => validSelectedIds.includes(el.id));
    if (copies.length > 0) setClipboard(copies);
  }, [scene.elements, validSelectedIds]);

  const pasteClipboard = useCallback(() => {
    if (clipboard.length === 0) return;
    const maxZ = topZ(scene.elements);
    const copies = clipboard.map((el, i) => ({
      ...el,
      id: crypto.randomUUID(),
      x: el.x + 20,
      y: el.y + 20,
      z: maxZ + i + 1,
    }));
    commit({ elements: [...scene.elements, ...copies] });
    setSelectedIds(copies.map((c) => c.id));
  }, [clipboard, scene.elements, commit]);

  function duplicateSelected() {
    if (!validSelectedIds.length) return;
    const next = duplicateElements(scene.elements, new Set(validSelectedIds));
    const newIds = next.slice(scene.elements.length).map((el) => el.id);
    commit({ elements: next });
    setSelectedIds(newIds);
  }

  // ── nudge (arrow keys) ───────────────────────────────────────────────────────

  const nudgeSelected = useCallback(
    (dx: number, dy: number) => {
      if (!validSelectedIds.length) return;
      const idSet = new Set(validSelectedIds);
      commit({
        elements: scene.elements.map((el) =>
          idSet.has(el.id) ? { ...el, x: el.x + dx, y: el.y + dy } : el,
        ),
      });
    },
    [validSelectedIds, scene.elements, commit],
  );

  // ── context menu ─────────────────────────────────────────────────────────────

  const handleContextMenu = useCallback(
    (x: number, y: number, elementId: string | null) => {
      // If right-clicked on an unselected element, select it first.
      if (elementId && !selectedIds.includes(elementId)) {
        setSelectedIds([elementId]);
      }
      setContextMenu({ x, y, elementId });
    },
    [selectedIds],
  );

  const closeContextMenu = useCallback(() => setContextMenu(null), []);

  // ── image upload ─────────────────────────────────────────────────────────────

  async function handleImageFile(file: File, worldX?: number, worldY?: number) {
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
      setSelectedIds([element.id]);
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

  function addImage() {
    if (!projectId) return;
    fileInputRef.current?.click();
  }

  function handleFileInputChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) void handleImageFile(file);
  }

  function handlePaste(e: React.ClipboardEvent<HTMLDivElement>) {
    if (!editing || !projectId) return;
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

  async function handleMediaFile(file: File, worldX?: number, worldY?: number) {
    if (!projectId) return;
    const kind = mediaKindForMime(file.type);
    if (kind !== 'audio' && kind !== 'video') {
      setUploadError("That file type isn't supported. Add an audio or video file.");
      return;
    }
    setUploadError(null);
    setIsUploading(true);
    try {
      const dims = kind === 'video' ? await getVideoDimensions(file) : AUDIO_SIZE;
      const { path } = await uploadCanvasMedia(projectId, note.id, file);
      const cx = worldX ?? (viewport.width / 2 - camera.x) / camera.scale;
      const cy = worldY ?? (viewport.height / 2 - camera.y) / camera.scale;
      const element = createMediaFileElement(cx, cy, topZ(scene.elements), kind, path, dims.width, dims.height);
      commit({ elements: [...scene.elements, element] });
      setSelectedIds([element.id]);
    } catch (err) {
      const msg =
        err instanceof MediaUploadError
          ? err.message
          : 'Something went wrong adding that media. Please try again.';
      setUploadError(msg);
    } finally {
      setIsUploading(false);
    }
  }

  function handleAddEmbed(embed: ParsedEmbed) {
    const cx = (viewport.width / 2 - camera.x) / camera.scale;
    const cy = (viewport.height / 2 - camera.y) / camera.scale;
    const element = createMediaEmbedElement(
      cx, cy, topZ(scene.elements), embed.kind, embed.embedUrl, embed.width, embed.height,
    );
    commit({ elements: [...scene.elements, element] });
    setSelectedIds([element.id]);
  }

  function handleDropFiles(worldX: number, worldY: number, files: File[]) {
    if (!editing || !projectId) return;
    const file = files[0];
    if (!file) return;
    const kind = mediaKindForMime(file.type);
    if (kind === 'audio' || kind === 'video') {
      void handleMediaFile(file, worldX, worldY);
    } else {
      void handleImageFile(file, worldX, worldY);
    }
  }

  // keyboard shortcuts
  const actionsRef = useRef({
    undo, redo, deleteSelected, changeTool,
    copySelected, pasteClipboard, duplicateSelected,
    bringToFrontAction, bringForwardAction, sendBackwardAction, sendToBackAction,
    nudgeSelected,
    hasSelection: false,
    hasClipboard: false,
  });

  useEffect(() => {
    actionsRef.current = {
      undo, redo, deleteSelected, changeTool,
      copySelected, pasteClipboard, duplicateSelected,
      bringToFrontAction, bringForwardAction, sendBackwardAction, sendToBackAction,
      nudgeSelected,
      hasSelection: validSelectedIds.length > 0,
      hasClipboard: clipboard.length > 0,
    };
  });

  useEffect(() => {
    if (!editing) return;
    function onKeyDown(event: KeyboardEvent) {
      if (editingTextId !== null) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      const meta = event.ctrlKey || event.metaKey;
      if (meta) {
        const key = event.key.toLowerCase();
        if (key === 'z') { event.preventDefault(); if (event.shiftKey) actionsRef.current.redo(); else actionsRef.current.undo(); return; }
        if (key === 'y') { event.preventDefault(); actionsRef.current.redo(); return; }
        if (key === 'c') { event.preventDefault(); actionsRef.current.copySelected(); return; }
        if (key === 'v') { event.preventDefault(); actionsRef.current.pasteClipboard(); return; }
        if (key === 'd') { event.preventDefault(); actionsRef.current.duplicateSelected(); return; }
        if (key === ']') { event.preventDefault(); if (event.shiftKey) actionsRef.current.bringToFrontAction(); else actionsRef.current.bringForwardAction(); return; }
        if (key === '[') { event.preventDefault(); if (event.shiftKey) actionsRef.current.sendToBackAction(); else actionsRef.current.sendBackwardAction(); return; }
        return;
      }
      if ((event.key === 'Delete' || event.key === 'Backspace') && actionsRef.current.hasSelection) {
        event.preventDefault(); actionsRef.current.deleteSelected(); return;
      }
      const step = event.shiftKey ? NUDGE_LARGE_STEP : NUDGE_STEP;
      if (event.key === 'ArrowLeft')  { event.preventDefault(); actionsRef.current.nudgeSelected(-step, 0); return; }
      if (event.key === 'ArrowRight') { event.preventDefault(); actionsRef.current.nudgeSelected(step, 0); return; }
      if (event.key === 'ArrowUp')    { event.preventDefault(); actionsRef.current.nudgeSelected(0, -step); return; }
      if (event.key === 'ArrowDown')  { event.preventDefault(); actionsRef.current.nudgeSelected(0, step); return; }
      if (event.key === 'v' || event.key === 'V') actionsRef.current.changeTool('select');
      else if (event.key === 'p' || event.key === 'P' || event.key === 'b' || event.key === 'B') actionsRef.current.changeTool('draw');
      else if (event.key === 'e' || event.key === 'E') actionsRef.current.changeTool('erase');
      else if (event.key === 't' || event.key === 'T') actionsRef.current.changeTool('text');
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [editing, editingTextId]);

  function handleDelete() {
    runDelete({ id: note.id });
    onDeleted();
  }

  const hasSelection = validSelectedIds.length > 0;
  const selectedLocked = primaryElement?.locked ?? false;

  return (
    <div className="flex flex-col gap-3" onPaste={handlePaste}>
      <input ref={fileInputRef} type="file" accept={IMAGE_ACCEPT} aria-hidden tabIndex={-1} className="sr-only" onChange={handleFileInputChange} />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <input
            value={title}
            maxLength={120}
            readOnly={!canEdit}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setTitle(event.target.value)}
            placeholder="Canvas title..."
            aria-label="Canvas title"
            className="w-full truncate bg-transparent font-display text-xl font-bold text-fg placeholder:text-fg-subtle focus:outline-none sm:text-2xl"
          />
          {canEdit && titleError && <p className="mt-1 text-xs text-danger">{titleError}</p>}
        </div>
        {canEdit && (
          <div className="flex shrink-0 items-center gap-2">
            {isUploading && (
              <span className="inline-flex items-center gap-1.5 text-xs text-fg-subtle">
                <Spinner size={12} className="text-current" /> Uploading...
              </span>
            )}
            <SaveIndicator status={status} />
            <button type="button" aria-label="Delete canvas" onClick={() => setConfirmingDelete((open) => !open)}
              className="grid h-9 w-9 place-items-center rounded-xl text-fg-subtle transition-colors hover:bg-danger/10 hover:text-danger">
              <Trash2 size={16} />
            </button>
          </div>
        )}
      </div>

      {confirmingDelete && canEdit && (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-fg-muted">
          <span>Delete <span className="font-semibold text-fg">{note.title}</span>? This cannot be undone.</span>
          <div className="flex shrink-0 items-center gap-1.5">
            <button type="button" onClick={() => setConfirmingDelete(false)} className="rounded-lg px-2 py-1 text-xs font-medium text-fg-muted hover:bg-[var(--glass-fill)]">Cancel</button>
            <button type="button" onClick={handleDelete} className="rounded-lg bg-danger/20 px-2 py-1 text-xs font-semibold text-danger hover:bg-danger/30">Delete</button>
          </div>
        </div>
      )}

      {uploadError && (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          <AlertCircle size={15} className="mt-0.5 shrink-0" />
          <span className="min-w-0 flex-1">{uploadError}</span>
          <button type="button" aria-label="Dismiss error" onClick={() => setUploadError(null)} className="shrink-0 rounded p-0.5 hover:bg-danger/20">
            <X size={13} />
          </button>
        </div>
      )}

      {canEdit && (
        <SegmentedToggle
          label="Canvas mode"
          value={mode}
          onChange={(next) => { setMode(next); setEditingTextId(null); }}
          options={[
            { value: 'edit', label: 'Edit', icon: <Pencil size={14} /> },
            { value: 'view', label: 'View', icon: <Eye size={14} /> },
          ]}
        />
      )}

      <div className="relative min-h-[82vh] w-full flex-1 sm:min-h-[78vh]">
        <div className="absolute inset-0">
          <CanvasStage
            elements={visibleElements}
            pageType={pageType}
            selectedIds={validSelectedIds}
            camera={camera}
            tool={effectiveTool}
            canEdit={editing}
            penSettings={pen}
            editingTextId={effectiveEditingId}
            onSelect={selectElements}
            onChangeElement={changeElement}
            onGroupMove={handleGroupMove}
            onCameraChange={setCamera}
            onViewportChange={handleViewportChange}
            onCommitStroke={commitStroke}
            onEraseStroke={eraseStroke}
            onEraseEnd={endErase}
            eraserMode={eraserMode}
            eraserSize={eraserSize}
            onPrecisionErase={handlePrecisionErase}
            onPlaceText={placeText}
            onEditText={editText}
            onEndTextEdit={endTextEdit}
            onDropFiles={editing && projectId !== null ? handleDropFiles : undefined}
            onContextMenu={handleContextMenu}
            fragmentFor={fragmentFor}
            caretProvider={caretProvider}
            caretUser={caretUser}
            onTextBodyChange={syncTextBody}
            onTextResize={handleTextResize}
            remotePeers={remotePeers}
            onPointerWorldMove={editing ? setLocalCursor : undefined}
          />
        </div>

        {viewport.width > 0 && (
          <div className="pointer-events-none absolute bottom-3 right-3 z-10 hidden sm:block">
            <CanvasMinimap
              elements={visibleElements}
              camera={camera}
              viewport={viewport}
              onCameraChange={setCamera}
            />
          </div>
        )}

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
            onAddPage={addPageText}
            onAddImage={projectId !== null ? addImage : undefined}
            onAddMedia={projectId !== null ? () => setMediaModalOpen(true) : undefined}
            hasSelection={hasSelection}
            selectedLocked={selectedLocked}
            onToggleLock={toggleLock}
            onDeleteSelected={deleteSelected}
            onDuplicate={duplicateSelected}
            onBringToFront={bringToFrontAction}
            onBringForward={bringForwardAction}
            onSendBackward={sendBackwardAction}
            onSendToBack={sendToBackAction}
            showLayers={showLayers}
            onToggleLayers={() => setShowLayers((v) => !v)}
          />
          {editing && tool === 'draw' && (
            <PenToolbar className="pointer-events-auto" settings={pen} onChange={setPen} />
          )}
          {editing && tool === 'erase' && (
            <EraserToolbar
              className="pointer-events-auto"
              mode={eraserMode}
              onMode={setEraserMode}
              size={eraserSize}
              onSize={setEraserSize}
            />
          )}
        </div>

        {editing && showLayers && (
          <LayersPanel
            elements={visibleElements}
            selectedIds={validSelectedIds}
            onSelect={selectElements}
            onToggleVisibility={toggleVisibility}
            onToggleLock={(id) => {
              const el = scene.elements.find((e) => e.id === id);
              if (el) commit({ elements: scene.elements.map((e) => e.id === id ? { ...e, locked: !e.locked } : e) });
            }}
            onJumpTo={(id) => {
              const el = scene.elements.find((e) => e.id === id);
              if (el) setCamera(centerCamera(el.x + el.width / 2, el.y + el.height / 2, viewport, camera.scale));
            }}
          />
        )}

        {contextMenu && (
          <ContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            elementId={contextMenu.elementId}
            selectionCount={validSelectedIds.length}
            hasClipboard={clipboard.length > 0}
            selectedLocked={selectedLocked}
            canEdit={editing}
            onBringToFront={() => { bringToFrontAction(); closeContextMenu(); }}
            onBringForward={() => { bringForwardAction(); closeContextMenu(); }}
            onSendBackward={() => { sendBackwardAction(); closeContextMenu(); }}
            onSendToBack={() => { sendToBackAction(); closeContextMenu(); }}
            onDuplicate={() => { duplicateSelected(); closeContextMenu(); }}
            onCopy={() => { copySelected(); closeContextMenu(); }}
            onPaste={() => { pasteClipboard(); closeContextMenu(); }}
            onToggleLock={() => { toggleLock(); closeContextMenu(); }}
            onDeleteSelected={() => { deleteSelected(); closeContextMenu(); }}
            onClose={closeContextMenu}
          />
        )}
      </div>

      {mediaModalOpen && projectId !== null && (
        <Suspense fallback={null}>
          <AddMediaModal
            open={mediaModalOpen}
            onClose={() => setMediaModalOpen(false)}
            onSubmitFile={(file) => { setMediaModalOpen(false); void handleMediaFile(file); }}
            onSubmitEmbed={(embed) => { setMediaModalOpen(false); handleAddEmbed(embed); }}
          />
        </Suspense>
      )}
    </div>
  );
}

function SaveIndicator({ status }: { status: SaveStatus }) {
  if (status === 'saving') return (
    <span className="inline-flex items-center gap-1.5 text-xs text-fg-subtle">
      <Spinner size={12} className="text-current" /> Saving...
    </span>
  );
  if (status === 'unsaved') return (
    <span className="inline-flex items-center gap-1.5 text-xs text-fg-subtle">
      <span className="h-1.5 w-1.5 rounded-full bg-warning" /> Unsaved
    </span>
  );
  if (status === 'error') return (
    <span className="inline-flex items-center gap-1.5 text-xs text-danger">
      <AlertCircle size={13} /> Could not save
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-fg-subtle">
      <Check size={13} className="text-success" /> Saved
    </span>
  );
}
