import { useEffect, useRef, useState } from 'react';
import { Stage, Layer, Transformer, Circle, Group } from 'react-konva';
import type Konva from 'konva';
import type { PageType } from '@/lib/canvasPages';
import { useElementSize } from '@/hooks/useElementSize';
import { ElementNode, ElementVisual } from './elementRenderers';
import { ShapeLabelEditor } from './ShapeLabelEditor';
import { elementsInLasso, elementsInRect, type WorldPoint } from './selection';
import {
  createClosedShape,
  createLineShape,
  defaultShapeStyle,
  isLineKind,
  isLineShape,
  lineEndpoints,
  lineGeometry,
  snapToShape,
  anchorPoint,
  SIDES,
} from './shapes';
import { textureTile } from './strokeTexture';
import { PageBackground } from './PageBackground';
import { TextLayer } from './TextLayer';
import { MediaLayer } from './MediaLayer';
import { TableLayer } from './TableLayer';
import { RemotePresenceLayer } from './RemotePresenceLayer';
import type { CaretUser } from './richText';
import type { RemotePeer } from './collab/awareness';
import type { XmlFragment } from 'yjs';
import { useCanvasPalette } from './useCanvasPalette';
import { strokeOutline, type ErasePoint, type StrokeStyle } from './freehand';
import { penStrokeStyle, type PenSettings } from './drawing';
import {
  LONG_PRESS_MS,
  MIN_ELEMENT_SIZE,
  ZOOM_STEP,
  clampScale,
  type Camera,
  type CanvasTool,
  type EraserMode,
  type ElementBox,
} from './constants';
import type { CanvasElement, ElementPatch, ShapeKind, StrokeTexture } from './elements';

interface CanvasStageProps {
  elements: CanvasElement[];
  pageType: PageType;
  /** Currently selected element ids (multi-select). */
  selectedIds: string[];
  camera: Camera;
  tool: CanvasTool;
  /** Editors transform/draw; viewers can still pan/zoom/select read-only. */
  canEdit: boolean;
  /** Live pen settings (drives the draw preview + the committed stroke style). */
  penSettings: PenSettings;
  onSelect: (ids: string[]) => void;
  onChangeElement: (id: string, patch: ElementPatch) => void;
  /** Batch-commit positions for all elements after a group drag. */
  onGroupMove: (moves: Array<{ id: string; x: number; y: number }>) => void;
  onCameraChange: (camera: Camera) => void;
  onViewportChange: (size: { width: number; height: number }) => void;
  /** A finished draw gesture: raw WORLD-space samples + the style it used. */
  onCommitStroke: (worldPoints: number[], style: StrokeStyle) => void;
  /** An element the eraser touched during the current gesture. */
  onEraseStroke: (id: string) => void;
  /** The eraser gesture ended — commit the batch as one undo step. */
  onEraseEnd: () => void;
  /** Eraser behaviour: whole-stroke ('object') vs partial ('precision'). */
  eraserMode: EraserMode;
  /** Precision-eraser nib radius in SCREEN px (converted to world via camera). */
  eraserSize: number;
  /** The newest stretch of a precision-erase scrub: world path + world nib radius. */
  onPrecisionErase: (path: ErasePoint[], radius: number) => void;
  /** The text tool was clicked at a world point — drop a text box there. */
  onPlaceText: (worldX: number, worldY: number) => void;
  /** The text box currently open for editing (null = none). */
  editingTextId: string | null;
  /** Double-click/tap on a text box requests editing it. */
  onEditText: (id: string) => void;
  /** Leave text-edit mode (e.g. Escape inside the editor). */
  onEndTextEdit: () => void;
  /**
   * One or more image/media files were dropped onto the canvas. World
   * coordinates are computed from the drop position using the current camera.
   */
  onDropFiles?: (worldX: number, worldY: number, files: File[]) => void;
  /**
   * Right-click or long-press at screen position (x, y) relative to the
   * canvas container. `elementId` is the hit element, or null for background.
   */
  onContextMenu: (x: number, y: number, elementId: string | null) => void;
  // ── collaboration (P3.7) ──
  /** This box's collaborative fragment (rich-text source of truth). */
  fragmentFor: (elementId: string) => XmlFragment;
  /** Awareness-bearing provider for remote carets. */
  caretProvider: { awareness: unknown };
  /** Local identity shown on the caret to other participants. */
  caretUser: CaretUser;
  /** Mirror an edited text box's body/text into the element cache. */
  onTextBodyChange: (id: string, body: Record<string, unknown>, text: string) => void;
  /** Report a text box's auto-grown height (world units). */
  onTextResize: (id: string, height: number) => void;
  /** Shape tool: which shape is being drawn, and the ink colour new ones start with. */
  shapeKind: ShapeKind;
  shapeInk: string;
  /** The shape tool finished a drag from `a` to `b` (world points). */
  onCreateShape: (a: WorldPoint, b: WorldPoint) => void;
  /** A lasso / rectangle selection finished with these element ids. */
  onAreaSelect: (ids: string[]) => void;
  /** Double-click/tap on a shape requests editing its label. */
  onEditShape: (id: string) => void;
  /** The shape whose label is open for editing (null = none). */
  editingShapeId: string | null;
  onCommitShapeLabel: (id: string, label: string) => void;
  onEndShapeEdit: () => void;
  /** Remote participants to draw (cursors + selection halos). */
  remotePeers: RemotePeer[];
  /** Report the local pointer's WORLD position for awareness (null = off-canvas). */
  onPointerWorldMove?: (world: { x: number; y: number } | null) => void;
}

/** How long after the last pen event we keep rejecting touch (palm rejection). */
const PEN_ACTIVE_MS = 800;

/** Once a stylus has touched this canvas we remember it, so a resting palm that
 *  lands BEFORE the pen can never start a stroke (the 800 ms window alone can't
 *  catch that order). Persisted so it also holds right after a reload. */
const PEN_SEEN_KEY = 'aurora.canvas.penSeen';

function readPenSeen(): boolean {
  try {
    return localStorage.getItem(PEN_SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

/** A touch contact this large is a palm / fist, not a fingertip. */
function isPalmContact(evt: PointerEvent): boolean {
  return evt.pointerType === 'touch' && (evt.width > 36 || evt.height > 36);
}

/** Paint a perfect-freehand outline as a smoothed filled shape. */
function fillOutline(ctx: CanvasRenderingContext2D, outline: number[][]) {
  const n = outline.length;
  if (n === 0) return;
  ctx.beginPath();
  ctx.moveTo(outline[0]![0]!, outline[0]![1]!);
  for (let i = 0; i < n; i += 1) {
    const a = outline[i]!;
    const b = outline[(i + 1) % n]!;
    ctx.quadraticCurveTo(a[0]!, a[1]!, (a[0]! + b[0]!) / 2, (a[1]! + b[1]!) / 2);
  }
  ctx.closePath();
  ctx.fill();
}

/** The fill for live ink: the stroke colour, or its pencil/crayon grain pattern. */
function grainFill(
  ctx: CanvasRenderingContext2D,
  texture: StrokeTexture | undefined,
  color: string,
): string | CanvasPattern {
  const tile = texture ? textureTile(texture, color) : null;
  return (tile && ctx.createPattern(tile, 'repeat')) || color;
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
function midpoint(a: { x: number; y: number }, b: { x: number; y: number }) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}
/** Lightest pressure we honour. A feather-light Pencil touch reports ~0.02, which
 *  renders as a hair-thin sliver that reads as a GAP in the line — so floor it. */
const MIN_PEN_PRESSURE = 0.25;

function pressureOf(evt: PointerEvent, isPen: boolean): number {
  if (!isPen) return 0.5;
  return Math.max(MIN_PEN_PRESSURE, evt.pressure > 0 ? evt.pressure : 0.5);
}

/** The fingers on screen — Apple Pencil contacts also appear in `touches`, but a
 *  stylus is never a pinch finger. */
function fingerTouches(evt: TouchEvent): Touch[] {
  return Array.from(evt.touches).filter(
    (t) => (t as Touch & { touchType?: string }).touchType !== 'stylus',
  );
}

/**
 * The infinite, pan/zoom Konva stage. The stage transform (x/y/scale) IS the
 * camera; the background + elements live in world space inside it.
 *
 * Tool modes:
 *   - select — drag empty space pans (stage draggable); click/tap selects;
 *     the <Transformer> moves/resizes/rotates the selection (supports multi).
 *     Shift+click adds/removes from the selection; Shift+drag on empty canvas
 *     draws a marquee and selects all intersecting elements.
 *   - draw   — pressure-sensitive strokes.
 *   - erase  — eraser removes strokes.
 *   - text   — click drops a text box.
 *
 * Two-finger pan/zoom and wheel-zoom work in every mode.
 * Palm rejection: once a pen has been seen, finger touch never draws/erases/places
 * text (fingers still pan/zoom with two); a palm-sized contact is always ignored.
 * Right-click anywhere fires onContextMenu.
 * Long-press (600 ms) on touch fires onContextMenu.
 */
export function CanvasStage({
  elements,
  pageType,
  selectedIds,
  camera,
  tool,
  canEdit,
  penSettings,
  onSelect,
  onChangeElement,
  onGroupMove,
  onCameraChange,
  onViewportChange,
  onCommitStroke,
  onEraseStroke,
  onEraseEnd,
  eraserMode,
  eraserSize,
  onPrecisionErase,
  onPlaceText,
  editingTextId,
  onEditText,
  onEndTextEdit,
  onDropFiles,
  onContextMenu,
  fragmentFor,
  caretProvider,
  caretUser,
  onTextBodyChange,
  onTextResize,
  remotePeers,
  onPointerWorldMove,
  shapeKind,
  shapeInk,
  onCreateShape,
  onAreaSelect,
  onEditShape,
  editingShapeId,
  onCommitShapeLabel,
  onEndShapeEdit,
}: CanvasStageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const inkRef = useRef<HTMLCanvasElement>(null);
  const inkRaf = useRef<number | null>(null);
  const cameraRef = useRef(camera);
  cameraRef.current = camera;
  const size = useElementSize(containerRef);
  const dpr = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1;
  const palette = useCanvasPalette(containerRef);

  // Live transform of the text/media box being dragged/resized so HTML overlays track it.
  const [liveBox, setLiveBox] = useState<ElementBox | null>(null);

  // Pinch bookkeeping (two-finger zoom/pan).
  const lastDist = useRef(0);
  const lastCenter = useRef<{ x: number; y: number } | null>(null);

  // Freehand stroke (world samples) and eraser gesture — refs to avoid
  // React renders on every pointer-move.
  const drawing = useRef<{
    pointerId: number;
    points: number[];
    style: StrokeStyle;
    isPen: boolean;
  } | null>(null);
  const erasing = useRef(false);

  // Palm rejection.
  const penActive = useRef(false);
  const penSeen = useRef(readPenSeen());
  const penTimer = useRef<number | null>(null);
  const lastPointerType = useRef<string>('');

  // Group drag: when multiple elements are selected and the user drags one of
  // them, we move all selected elements by the same delta and batch-commit on end.
  const groupDragOrigins = useRef<Map<string, { x: number; y: number }> | null>(null);
  const groupDragPendingMoves = useRef<Map<string, { x: number; y: number }>>(new Map());

  // Marquee selection (shift+drag on empty canvas).
  const [marquee, setMarquee] = useState<{
    x1: number; y1: number; x2: number; y2: number;
  } | null>(null);
  const marqueeStartScreen = useRef<{ x: number; y: number } | null>(null);
  /** True while a marquee drag is in progress — suppresses the stage pan. */
  const preventPan = useRef(false);

  // Long-press context menu on touch.
  const longPressTimer = useRef<number | null>(null);
  const longPressPos = useRef<{ clientX: number; clientY: number } | null>(null);
  const longPressElementId = useRef<string | null>(null);

  const markPen = () => {
    if (!penSeen.current) {
      penSeen.current = true;
      try {
        localStorage.setItem(PEN_SEEN_KEY, '1');
      } catch {
        /* storage unavailable — the in-memory flag still protects this session */
      }
    }
    penActive.current = true;
    if (penTimer.current !== null) window.clearTimeout(penTimer.current);
    penTimer.current = window.setTimeout(() => { penActive.current = false; }, PEN_ACTIVE_MS);
  };

  useEffect(() => () => {
    if (penTimer.current !== null) window.clearTimeout(penTimer.current);
    if (longPressTimer.current !== null) window.clearTimeout(longPressTimer.current);
    if (inkRaf.current !== null) cancelAnimationFrame(inkRaf.current);
  }, []);

  // iOS selects text / shows the callout when a palm rests on the page. The
  // canvas is a drawing surface, so block selection everywhere inside it except
  // in real text inputs (text boxes, frame names).
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const block = (e: Event) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest('[contenteditable="true"], input, textarea')) return;
      e.preventDefault();
    };
    el.addEventListener('selectstart', block);
    el.addEventListener('dragstart', block);
    return () => {
      el.removeEventListener('selectstart', block);
      el.removeEventListener('dragstart', block);
    };
  }, []);

  useEffect(() => {
    if (size.width > 0 && size.height > 0) onViewportChange(size);
  }, [size, onViewportChange]);

  // Attach the Transformer to ALL selected, unlocked, editable elements.
  // In select mode only; drawing/erasing hides handles to keep things clean.
  useEffect(() => {
    const transformer = transformerRef.current;
    const stage = stageRef.current;
    if (!transformer || !stage) return;

    if (!canEdit || tool !== 'select' || editingTextId !== null) {
      transformer.nodes([]);
      transformer.getLayer()?.batchDraw();
      return;
    }

    // A lone line/arrow is edited with end-point handles, not a bounding box.
    const lone = selectedIds.length === 1 ? elements.find((e) => e.id === selectedIds[0]) : undefined;
    if (lone && isLineShape(lone)) {
      transformer.nodes([]);
      transformer.getLayer()?.batchDraw();
      return;
    }

    const nodes: Konva.Node[] = [];
    for (const id of selectedIds) {
      const el = elements.find((e) => e.id === id);
      if (!el || el.locked || el.visible === false) continue;
      const node = stage.findOne(`#${id}`);
      if (node) nodes.push(node);
    }
    transformer.nodes(nodes);
    transformer.getLayer()?.batchDraw();
  }, [selectedIds, elements, canEdit, tool, editingTextId]);

  // ── coordinate helpers ──────────────────────────────────────────────────────

  function toWorld(clientX: number, clientY: number): { x: number; y: number } | null {
    const stage = stageRef.current;
    if (!stage) return null;
    const rect = stage.container().getBoundingClientRect();
    return {
      x: (clientX - rect.left - camera.x) / camera.scale,
      y: (clientY - rect.top - camera.y) / camera.scale,
    };
  }

  /** Convert a client coordinate to a position relative to the canvas container. */
  function toContainer(clientX: number, clientY: number): { x: number; y: number } {
    const rect = containerRef.current?.getBoundingClientRect() ?? { left: 0, top: 0 };
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  // ── gesture listener management ─────────────────────────────────────────────

  const gestureCleanup = useRef<(() => void) | null>(null);

  function endGestureListeners() {
    gestureCleanup.current?.();
    gestureCleanup.current = null;
  }

  function startGestureListeners(
    onMove: (evt: PointerEvent) => void,
    onUp: (evt: PointerEvent) => void,
    onCancel: (evt: PointerEvent) => void,
  ) {
    endGestureListeners();
    const move = (evt: PointerEvent) => onMove(evt);
    const up = (evt: PointerEvent) => onUp(evt);
    const cancel = (evt: PointerEvent) => onCancel(evt);
    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
    gestureCleanup.current = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
    };
  }

  useEffect(() => () => endGestureListeners(), []);

  // ── drawing ─────────────────────────────────────────────────────────────────

  // The in-progress stroke is painted on a plain 2D canvas overlay, once per
  // animation frame — far cheaper than rebuilding an SVG path string and
  // re-parsing it in Konva on every pointer event.
  function renderInk() {
    const canvas = inkRef.current;
    const d = drawing.current;
    if (!canvas || !d) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const cam = cameraRef.current;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr * cam.scale, 0, 0, dpr * cam.scale, dpr * cam.x, dpr * cam.y);
    ctx.fillStyle = grainFill(ctx, d.style.texture, d.style.color);
    ctx.globalAlpha = d.style.opacity;
    fillOutline(ctx, strokeOutline(d.points, d.style));
  }

  function paintPreview() {
    if (inkRaf.current !== null) return;
    inkRaf.current = requestAnimationFrame(() => {
      inkRaf.current = null;
      renderInk();
    });
  }

  function clearInkNow() {
    const canvas = inkRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  /** Clear after the committed stroke has had two frames to appear, so the ink
   *  never blinks out between "pen up" and the Konva element rendering. */
  function clearPreview() {
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (!drawing.current) clearInkNow();
    }));
  }

  function startStroke(e: Konva.KonvaEventObject<PointerEvent>) {
    const isPen = e.evt.pointerType === 'pen';
    const start = toWorld(e.evt.clientX, e.evt.clientY);
    if (!start) return;
    const style = penStrokeStyle(penSettings, !isPen);
    drawing.current = {
      pointerId: e.evt.pointerId,
      points: [start.x, start.y, pressureOf(e.evt, isPen)],
      style,
      isPen,
    };
    const canvas = inkRef.current;
    if (canvas) canvas.style.mixBlendMode = style.blend === 'multiply' ? 'multiply' : 'normal';
    paintPreview();
    startGestureListeners(extendStroke, endStroke, cancelStroke);
  }

  function extendStroke(evt: PointerEvent) {
    const d = drawing.current;
    if (!d || evt.pointerId !== d.pointerId) return;
    if (evt.pointerType === 'pen') markPen();
    if (evt.cancelable) evt.preventDefault();
    const isPen = evt.pointerType === 'pen';
    const coalesced = typeof evt.getCoalescedEvents === 'function' ? evt.getCoalescedEvents() : [];
    const events = coalesced.length > 0 ? coalesced : [evt];
    for (const ev of events) {
      const p = toWorld(ev.clientX, ev.clientY);
      if (!p) continue;
      d.points.push(p.x, p.y, pressureOf(ev, isPen));
    }
    paintPreview();
  }

  function endStroke(evt: PointerEvent) {
    const d = drawing.current;
    if (!d || evt.pointerId !== d.pointerId) return;
    drawing.current = null;
    endGestureListeners();
    clearPreview();
    if (d.points.length >= 3) onCommitStroke(d.points, d.style);
  }

  function cancelStroke() {
    if (!drawing.current) return;
    drawing.current = null;
    endGestureListeners();
    clearPreview();
  }

  // ── erasing ─────────────────────────────────────────────────────────────────

  function eraseAtScreen(screenX: number, screenY: number) {
    const stage = stageRef.current;
    if (!stage) return;
    const rect = stage.container().getBoundingClientRect();
    const base = { x: screenX - rect.left, y: screenY - rect.top };
    const r = 6;
    const probes = [
      base,
      { x: base.x - r, y: base.y },
      { x: base.x + r, y: base.y },
      { x: base.x, y: base.y - r },
      { x: base.x, y: base.y + r },
    ];
    for (const pos of probes) {
      const shape = stage.getIntersection(pos);
      const group = shape?.findAncestor('.canvas-element', true);
      if (group) { onEraseStroke(group.id()); return; }
    }
  }

  // Precision eraser: the world-space path the nib travels. Each move reports
  // only the newest stretch (joined to the previous point) so the erase is live.
  const lastErase = useRef<ErasePoint | null>(null);
  const eraseRing = useRef<HTMLDivElement>(null);

  function worldNibRadius(): number {
    return eraserSize / 2 / cameraRef.current.scale;
  }

  function recordErase(clientX: number, clientY: number) {
    const p = toWorld(clientX, clientY);
    if (!p) return;
    const prev = lastErase.current;
    lastErase.current = p;
    onPrecisionErase(prev ? [prev, p] : [p], worldNibRadius());
  }

  function extendErase(evt: PointerEvent) {
    if (!erasing.current) return;
    if (evt.cancelable) evt.preventDefault();
    if (eraserMode === 'precision') {
      const coalesced = typeof evt.getCoalescedEvents === 'function' ? evt.getCoalescedEvents() : [];
      for (const ev of coalesced.length > 0 ? coalesced : [evt]) recordErase(ev.clientX, ev.clientY);
      moveEraseRing(evt.clientX, evt.clientY, true);
    } else {
      eraseAtScreen(evt.clientX, evt.clientY);
    }
  }

  function endErase() {
    if (!erasing.current) return;
    erasing.current = false;
    lastErase.current = null;
    endGestureListeners();
    onEraseEnd();
  }

  /** Position the nib ring under the pointer (mouse / pen hover; hidden for touch). */
  function moveEraseRing(clientX: number, clientY: number, visible: boolean) {
    const ring = eraseRing.current;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!ring || !rect) return;
    ring.style.opacity = visible ? '1' : '0';
    ring.style.transform = `translate(${clientX - rect.left - eraserSize / 2}px, ${clientY - rect.top - eraserSize / 2}px)`;
  }

  // ── marquee selection ────────────────────────────────────────────────────────
  // Shift+drag on the stage background draws a selection rect; on release, all
  // elements whose screen-projected bounding box intersects the rect are selected.

  function startMarquee(clientX: number, clientY: number) {
    preventPan.current = true;
    marqueeStartScreen.current = { x: clientX, y: clientY };
    const cp = toContainer(clientX, clientY);
    setMarquee({ x1: cp.x, y1: cp.y, x2: cp.x, y2: cp.y });
    startGestureListeners(
      (evt) => {
        const start = marqueeStartScreen.current;
        if (!start) return;
        const cp2 = toContainer(evt.clientX, evt.clientY);
        const startCp = toContainer(start.x, start.y);
        setMarquee({ x1: startCp.x, y1: startCp.y, x2: cp2.x, y2: cp2.y });
      },
      (evt) => {
        const start = marqueeStartScreen.current;
        preventPan.current = false;
        marqueeStartScreen.current = null;
        setMarquee(null);
        endGestureListeners();
        if (!start) return;
        const c1 = toContainer(start.x, start.y);
        const c2 = toContainer(evt.clientX, evt.clientY);
        const minX = Math.min(c1.x, c2.x);
        const minY = Math.min(c1.y, c2.y);
        const maxX = Math.max(c1.x, c2.x);
        const maxY = Math.max(c1.y, c2.y);
        if (maxX - minX < 4 && maxY - minY < 4) return; // too small — no-op
        // Project each element bounding box to container coords and check intersection.
        const hit: string[] = [];
        for (const el of elements) {
          if (el.visible === false) continue;
          const sl = el.x * camera.scale + camera.x;
          const st = el.y * camera.scale + camera.y;
          const sr = (el.x + el.width) * camera.scale + camera.x;
          const sb = (el.y + el.height) * camera.scale + camera.y;
          if (sl < maxX && sr > minX && st < maxY && sb > minY) {
            hit.push(el.id);
          }
        }
        if (hit.length > 0) onSelect(hit);
      },
      () => {
        preventPan.current = false;
        marqueeStartScreen.current = null;
        setMarquee(null);
        endGestureListeners();
      },
    );
  }

  // ── lasso / rectangle select ──────────────────────────────────────────────────
  // Drag a loop (lasso) or a rectangle (marquee); on release everything inside is
  // selected and the editor switches to Select so it can be moved, resized or
  // rotated straight away.

  const [area, setArea] = useState<{ kind: 'lasso' | 'marquee'; points: WorldPoint[] } | null>(null);
  const areaRef = useRef<{
    kind: 'lasso' | 'marquee';
    pointerId: number;
    points: WorldPoint[];
  } | null>(null);
  const areaRaf = useRef<number | null>(null);

  function flushArea() {
    if (areaRaf.current !== null) return;
    areaRaf.current = requestAnimationFrame(() => {
      areaRaf.current = null;
      const a = areaRef.current;
      setArea(a ? { kind: a.kind, points: a.points.slice() } : null);
    });
  }

  function startAreaSelect(evt: PointerEvent, kind: 'lasso' | 'marquee') {
    const start = toWorld(evt.clientX, evt.clientY);
    if (!start) return;
    areaRef.current = { kind, pointerId: evt.pointerId, points: [start] };
    flushArea();
    startGestureListeners(
      (move) => {
        const a = areaRef.current;
        if (!a || move.pointerId !== a.pointerId) return;
        if (move.cancelable) move.preventDefault();
        const events = typeof move.getCoalescedEvents === 'function' ? move.getCoalescedEvents() : [];
        for (const ev of events.length > 0 ? events : [move]) {
          const p = toWorld(ev.clientX, ev.clientY);
          if (p) a.points.push(p);
        }
        flushArea();
      },
      (up) => {
        const a = areaRef.current;
        if (!a || up.pointerId !== a.pointerId) return;
        areaRef.current = null;
        endGestureListeners();
        setArea(null);
        const pts = a.points;
        if (pts.length < 2) {
          onAreaSelect([]);
          return;
        }
        if (a.kind === 'marquee') {
          const first = pts[0]!;
          const last = pts[pts.length - 1]!;
          onAreaSelect(
            elementsInRect(elements, {
              minX: Math.min(first.x, last.x),
              minY: Math.min(first.y, last.y),
              maxX: Math.max(first.x, last.x),
              maxY: Math.max(first.y, last.y),
            }),
          );
        } else {
          onAreaSelect(elementsInLasso(elements, pts));
        }
      },
      () => {
        areaRef.current = null;
        endGestureListeners();
        setArea(null);
      },
    );
  }

  // ── shape tool ────────────────────────────────────────────────────────────────
  // Press, drag to size, release: the shape (or arrow from press to release) is
  // created by the editor. A plain click drops one at a sensible default size.

  const [shapeDraft, setShapeDraft] = useState<{ a: WorldPoint; b: WorldPoint } | null>(null);
  const shapeRef = useRef<{ pointerId: number; a: WorldPoint; b: WorldPoint } | null>(null);

  function startShapeDrag(evt: PointerEvent) {
    const a = toWorld(evt.clientX, evt.clientY);
    if (!a) return;
    shapeRef.current = { pointerId: evt.pointerId, a, b: a };
    setShapeDraft({ a, b: a });
    startGestureListeners(
      (move) => {
        const d = shapeRef.current;
        if (!d || move.pointerId !== d.pointerId) return;
        if (move.cancelable) move.preventDefault();
        const b = toWorld(move.clientX, move.clientY);
        if (!b) return;
        d.b = isLineKind(shapeKind) ? (snapToShape(b, elements, 14 / cameraRef.current.scale)?.point ?? b) : b;
        setShapeDraft({ a: d.a, b: d.b });
      },
      (up) => {
        const d = shapeRef.current;
        if (!d || up.pointerId !== d.pointerId) return;
        shapeRef.current = null;
        endGestureListeners();
        setShapeDraft(null);
        onCreateShape(d.a, d.b);
      },
      () => {
        shapeRef.current = null;
        endGestureListeners();
        setShapeDraft(null);
      },
    );
  }

  // The translucent preview of the shape being dragged out.
  const draftElement: CanvasElement | null = shapeDraft
    ? (isLineKind(shapeKind)
        ? createLineShape(shapeKind, shapeDraft.a, shapeDraft.b, elements, defaultShapeStyle(shapeKind, shapeInk))
        : createClosedShape(shapeKind, shapeDraft.a, shapeDraft.b, elements, defaultShapeStyle(shapeKind, shapeInk)))
    : null;

  // ── arrow end-point handles ───────────────────────────────────────────────────
  // A lone selected line/arrow is reshaped by dragging its two ends (Transformer
  // box handles make no sense on a hairline). Ends snap to a shape's connection
  // points and stay glued to it.

  const [lineDrag, setLineDrag] = useState<{
    id: string;
    a: WorldPoint;
    b: WorldPoint;
    startBind: string | null;
    endBind: string | null;
  } | null>(null);

  function dragLineEnd(el: CanvasElement, end: 'a' | 'b', raw: WorldPoint) {
    if (!isLineShape(el)) return;
    const snap = snapToShape(raw, elements, 16 / cameraRef.current.scale, el.id);
    const point = snap?.point ?? raw;
    setLineDrag((prev) => {
      const [a0, b0] = lineEndpoints(el);
      const base = prev?.id === el.id ? prev : { id: el.id, a: a0, b: b0, startBind: el.startBind, endBind: el.endBind };
      return end === 'a'
        ? { ...base, a: point, startBind: snap?.bind ?? null }
        : { ...base, b: point, endBind: snap?.bind ?? null };
    });
  }

  function commitLineDrag() {
    const d = lineDrag;
    setLineDrag(null);
    if (!d) return;
    onChangeElement(d.id, {
      ...lineGeometry(d.a, d.b),
      rotation: 0,
      startBind: d.startBind,
      endBind: d.endBind,
    });
  }

  // ── long-press (touch context menu) ─────────────────────────────────────────

  function cancelLongPress() {
    if (longPressTimer.current !== null) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    longPressPos.current = null;
    longPressElementId.current = null;
  }

  function startLongPress(clientX: number, clientY: number, elementId: string | null) {
    cancelLongPress();
    longPressPos.current = { clientX, clientY };
    longPressElementId.current = elementId;
    longPressTimer.current = window.setTimeout(() => {
      longPressTimer.current = null;
      const pos = longPressPos.current;
      if (!pos) return;
      const cp = toContainer(pos.clientX, pos.clientY);
      onContextMenu(cp.x, cp.y, longPressElementId.current);
    }, LONG_PRESS_MS);
  }

  // ── pointer routing ──────────────────────────────────────────────────────────

  function handlePointerDown(e: Konva.KonvaEventObject<PointerEvent>) {
    if (!canEdit) return;
    const type = e.evt.pointerType;
    if (type === 'pen') markPen();

    // Palm rejection. A palm usually lands BEFORE the pen, so the short "pen is
    // active" window isn't enough: once any stylus has been seen, fingers never
    // draw, erase or drop text (they still pan/zoom). Palm-sized contacts are
    // always ignored, pen or no pen.
    if (type === 'touch' && (penSeen.current || penActive.current || isPalmContact(e.evt))) {
      if (tool !== 'select') return;
    }

    window.getSelection()?.removeAllRanges();

    if (tool === 'text') {
      const p = toWorld(e.evt.clientX, e.evt.clientY);
      if (p) onPlaceText(p.x, p.y);
      return;
    }

    if (tool === 'lasso' || tool === 'marquee') {
      if (e.evt.cancelable) e.evt.preventDefault();
      startAreaSelect(e.evt, tool);
      return;
    }
    if (tool === 'shape') {
      if (e.evt.cancelable) e.evt.preventDefault();
      startShapeDrag(e.evt);
      return;
    }

    if (tool !== 'draw' && tool !== 'erase') return;
    if (type === 'touch' && !e.evt.isPrimary) {
      cancelStroke();
      endErase();
      return;
    }
    // The pen landed while a finger/palm stroke was running: drop the stray one.
    if (type === 'pen' && drawing.current && drawing.current.pointerId !== e.evt.pointerId) {
      cancelStroke();
    }
    if (e.evt.cancelable) e.evt.preventDefault();

    if (tool === 'draw') {
      startStroke(e);
    } else {
      erasing.current = true;
      lastErase.current = null;
      startGestureListeners(extendErase, endErase, endErase);
      if (eraserMode === 'precision') {
        recordErase(e.evt.clientX, e.evt.clientY);
        moveEraseRing(e.evt.clientX, e.evt.clientY, true);
      } else {
        eraseAtScreen(e.evt.clientX, e.evt.clientY);
      }
    }
  }

  // ── camera (wheel + pinch) + selection ──────────────────────────────────────

  function zoomToPoint(pointer: { x: number; y: number }, nextScale: number) {
    const scale = clampScale(nextScale);
    const worldX = (pointer.x - camera.x) / camera.scale;
    const worldY = (pointer.y - camera.y) / camera.scale;
    onCameraChange({ scale, x: pointer.x - worldX * scale, y: pointer.y - worldY * scale });
  }

  function handleWheel(e: Konva.KonvaEventObject<WheelEvent>) {
    e.evt.preventDefault();
    const stage = stageRef.current;
    const pointer = stage?.getPointerPosition();
    if (!pointer) return;
    const zoomingIn = e.evt.deltaY < 0;
    zoomToPoint(pointer, zoomingIn ? camera.scale * ZOOM_STEP : camera.scale / ZOOM_STEP);
  }

  function syncStageCamera(e: Konva.KonvaEventObject<DragEvent>) {
    const stage = stageRef.current;
    if (!stage || e.target !== stage) return;
    if (preventPan.current) {
      stage.stopDrag();
      return;
    }
    onCameraChange({ x: stage.x(), y: stage.y(), scale: stage.scaleX() });
  }

  function handleMouseDown(e: Konva.KonvaEventObject<MouseEvent>) {
    if (tool !== 'select') return;
    if (e.target !== stageRef.current) return;
    if (e.evt.shiftKey) {
      // Shift+drag on empty canvas = marquee selection.
      // Stop the stage pan that Konva starts on mousedown before we intercept.
      stageRef.current?.stopDrag();
      startMarquee(e.evt.clientX, e.evt.clientY);
    } else {
      onSelect([]);
    }
  }

  /** Two-finger pan/zoom is only for bare fingers: while the pen is working, a
   *  resting palm (+ the Pencil itself) must never cancel the stroke or move the page. */
  function pinchAllowed(evt: TouchEvent): boolean {
    if (penActive.current || drawing.current?.isPen) return false;
    return fingerTouches(evt).length >= 2;
  }

  function handleTouchStart(e: Konva.KonvaEventObject<TouchEvent>) {
    if (pinchAllowed(e.evt)) {
      cancelStroke();
      endErase();
      cancelLongPress();
      stageRef.current?.stopDrag();
      lastDist.current = 0;
      lastCenter.current = null;
    } else if (tool === 'select') {
      if (e.target === stageRef.current) {
        onSelect([]);
      } else {
        // Hit on an element — start long-press timer.
        const shape = e.target as Konva.Node;
        const group = shape.findAncestor?.('.canvas-element', true);
        const id = group?.id() ?? null;
        startLongPress(e.evt.touches[0]!.clientX, e.evt.touches[0]!.clientY, id);
      }
    }
  }

  function handleTouchMove(e: Konva.KonvaEventObject<TouchEvent>) {
    cancelLongPress();

    if (!pinchAllowed(e.evt)) return;
    const touches = fingerTouches(e.evt);
    e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;

    const rect = stage.container().getBoundingClientRect();
    const p1 = { x: touches[0]!.clientX - rect.left, y: touches[0]!.clientY - rect.top };
    const p2 = { x: touches[1]!.clientX - rect.left, y: touches[1]!.clientY - rect.top };
    const center = midpoint(p1, p2);
    const dist = distance(p1, p2);

    if (!lastCenter.current || lastDist.current === 0) {
      lastCenter.current = center;
      lastDist.current = dist;
      return;
    }

    const oldScale = stage.scaleX();
    const scale = clampScale(oldScale * (dist / lastDist.current));
    const worldX = (center.x - stage.x()) / oldScale;
    const worldY = (center.y - stage.y()) / oldScale;
    const dx = center.x - lastCenter.current.x;
    const dy = center.y - lastCenter.current.y;
    onCameraChange({
      scale,
      x: center.x - worldX * scale + dx,
      y: center.y - worldY * scale + dy,
    });

    lastCenter.current = center;
    lastDist.current = dist;
  }

  function handleTouchEnd(e: Konva.KonvaEventObject<TouchEvent>) {
    cancelLongPress();
    if (fingerTouches(e.evt).length < 2) {
      lastDist.current = 0;
      lastCenter.current = null;
    }
  }

  // right-click context menu
  function handleContextMenu(e: Konva.KonvaEventObject<MouseEvent>) {
    e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;
    const rect = stage.container().getBoundingClientRect();
    const pos = { x: e.evt.clientX - rect.left, y: e.evt.clientY - rect.top };
    const shape = stage.getIntersection(pos);
    const group = shape?.findAncestor('.canvas-element', true);
    const id = group?.id() ?? null;
    const cp = toContainer(e.evt.clientX, e.evt.clientY);
    onContextMenu(cp.x, cp.y, id);
  }

  function handleElementSelect(id: string, addToSelection: boolean) {
    if (addToSelection) {
      const next = selectedIds.includes(id)
        ? selectedIds.filter((sid) => sid !== id)
        : [...selectedIds, id];
      onSelect(next);
    } else {
      onSelect([id]);
    }
  }

  // group drag
  function handleGroupDragEnd(id: string, x: number, y: number) {
    groupDragPendingMoves.current.set(id, { x, y });
    window.setTimeout(() => {
      const moves = groupDragPendingMoves.current;
      if (moves.size === 0) return;
      groupDragPendingMoves.current = new Map();
      groupDragOrigins.current = null;
      onGroupMove(Array.from(moves.entries()).map(([eid, pos]) => ({ id: eid, ...pos })));
    }, 0);
  }

  function handleStageDragStart(e: Konva.KonvaEventObject<DragEvent>) {
    if (e.target === stageRef.current) {
      // A palm resting while the pen is working must not drag the page around.
      if (lastPointerType.current === 'touch' && penActive.current) stageRef.current?.stopDrag();
      return;
    }
    if (selectedIds.length <= 1) return;
    const stage = stageRef.current;
    if (!stage) return;
    const origins = new Map<string, { x: number; y: number }>();
    for (const sid of selectedIds) {
      const node = stage.findOne(`#${sid}`);
      if (node) origins.set(sid, { x: node.x(), y: node.y() });
    }
    groupDragOrigins.current = origins;
    groupDragPendingMoves.current = new Map();
  }

  function handleStageDragMove(e: Konva.KonvaEventObject<DragEvent>) {
    if (e.target === stageRef.current) {
      syncStageCamera(e);
      return;
    }
    const origins = groupDragOrigins.current;
    if (!origins || selectedIds.length <= 1) return;
    const draggedId = (e.target as Konva.Node).id?.() ?? '';
    if (!selectedIds.includes(draggedId)) return;
    const origin = origins.get(draggedId);
    const node = e.target as Konva.Node;
    if (!origin) return;
    const dx = node.x() - origin.x;
    const dy = node.y() - origin.y;
    const stage = stageRef.current;
    if (!stage) return;
    for (const [sid, spos] of origins) {
      if (sid === draggedId) continue;
      const snode = stage.findOne(`#${sid}`);
      if (snode) {
        snode.x(spos.x + dx);
        snode.y(spos.y + dy);
      }
    }
  }

  // The scene as drawn: a line being re-aimed follows its handle live.
  const shown = lineDrag
    ? elements.map((el) =>
        el.id === lineDrag.id && isLineShape(el)
          ? { ...el, ...lineGeometry(lineDrag.a, lineDrag.b), rotation: 0 }
          : el,
      )
    : elements;

  // derived state
  const primaryId = selectedIds[0] ?? null;
  const primaryElement = primaryId ? elements.find((el) => el.id === primaryId) : null;

  const keepRatio =
    primaryElement?.type === 'image' ||
    (primaryElement?.type === 'media' && primaryElement.kind === 'video');

  // A table's box is DERIVED (colWidths sum / rows * row height — see
  // elements.ts's table* helpers), not free-form, so a corner-drag resize
  // would desync the Konva hit-rect from the HTML grid it's supposed to
  // track. Resizing a table only ever happens by dragging a column border
  // (TableGrid's own resize handles) or adding/removing rows/columns — so the
  // Transformer keeps rotate (still useful) but loses its resize handles
  // whenever the sole selection is a table.
  const resizeEnabled = !(selectedIds.length === 1 && primaryElement?.type === 'table');

  const transformerPadding = selectedIds.some(
    (id) => elements.find((el) => el.id === id)?.type === 'media',
  ) ? 6 : 0;

  const cursor =
    tool === 'draw' || tool === 'lasso' || tool === 'marquee' || tool === 'shape' ? 'crosshair'
    : tool === 'erase' ? 'cell'
    : tool === 'text' ? 'text'
    : 'default';

  const isGroupDrag = selectedIds.length > 1;
  // A selection containing a line/arrow may legitimately be a hairline-thin box.
  const hasLine = selectedIds.some((id) => {
    const el = elements.find((e) => e.id === id);
    return !!el && isLineShape(el);
  });

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    if (!onDropFiles) return;
    if (Array.from(e.dataTransfer.types).includes('Files')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    }
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    if (!onDropFiles || !containerRef.current) return;
    const files = Array.from(e.dataTransfer.files).filter(
      (f) => f.type.startsWith('image/') || f.type.startsWith('audio/') || f.type.startsWith('video/'),
    );
    if (files.length === 0) return;
    const rect = containerRef.current.getBoundingClientRect();
    const worldX = (e.clientX - rect.left - camera.x) / camera.scale;
    const worldY = (e.clientY - rect.top - camera.y) / camera.scale;
    onDropFiles(worldX, worldY, files);
  }

  // ── cursor reporting (awareness) ──────────────────────────────────────────
  // Throttle to one report per animation frame so a fast pointer doesn't flood
  // awareness; the provider additionally throttles the network broadcast.
  const cursorRaf = useRef<number | null>(null);
  useEffect(() => () => { if (cursorRaf.current !== null) cancelAnimationFrame(cursorRaf.current); }, []);
  function reportCursor(clientX: number, clientY: number) {
    if (!onPointerWorldMove || cursorRaf.current !== null) return;
    cursorRaf.current = requestAnimationFrame(() => {
      cursorRaf.current = null;
      onPointerWorldMove(toWorld(clientX, clientY));
    });
  }

  const marqueeStyle: React.CSSProperties | null = marquee
    ? {
        left: Math.min(marquee.x1, marquee.x2),
        top: Math.min(marquee.y1, marquee.y2),
        width: Math.abs(marquee.x2 - marquee.x1),
        height: Math.abs(marquee.y2 - marquee.y1),
      }
    : null;

  return (
    <div
      ref={containerRef}
      className="canvas-surface relative h-full w-full overflow-hidden rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-fill)]"
      style={{ touchAction: 'none', cursor }}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onPointerDownCapture={(e) => {
        lastPointerType.current = e.pointerType;
        if (e.pointerType === 'pen') markPen();
      }}
      onPointerMove={(e) => {
        // Apple Pencil hover also proves a stylus is present.
        if (e.pointerType === 'pen') markPen();
        reportCursor(e.clientX, e.clientY);
        if (tool === 'erase' && eraserMode === 'precision') {
          moveEraseRing(e.clientX, e.clientY, e.pointerType !== 'touch');
        }
      }}
      onPointerLeave={() => {
        onPointerWorldMove?.(null);
        moveEraseRing(0, 0, false);
      }}
    >
      {size.width > 0 && size.height > 0 && (
        <Stage
          ref={stageRef}
          width={size.width}
          height={size.height}
          x={camera.x}
          y={camera.y}
          scaleX={camera.scale}
          scaleY={camera.scale}
          draggable={tool === 'select'}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onPointerDown={handlePointerDown}
          onDragStart={handleStageDragStart}
          onDragMove={handleStageDragMove}
          onDragEnd={syncStageCamera}
          onContextMenu={handleContextMenu}
        >
          <Layer listening={false}>
            <PageBackground
              width={size.width}
              height={size.height}
              camera={camera}
              pageType={pageType}
              palette={palette}
            />
          </Layer>
          {/* Hit-testing every pointer move is wasted work while inking. */}
          <Layer listening={tool !== 'draw'}>
            {shown.map((element) => (
              <ElementNode
                key={element.id}
                element={element}
                draggable={
                  canEdit && tool === 'select' && !element.locked && element.id !== editingTextId
                }
                selectable={canEdit && tool === 'select'}
                palette={palette}
                onSelect={handleElementSelect}
                onChange={onChangeElement}
                onRequestEdit={
                  canEdit && tool === 'select' && !element.locked
                    ? element.type === 'text'
                      ? onEditText
                      : element.type === 'shape' && !isLineKind(element.kind)
                        ? onEditShape
                        : undefined
                    : undefined
                }
                onLiveChange={
                  element.type === 'text' || element.type === 'media' || element.type === 'table'
                    ? setLiveBox
                    : undefined
                }
                onGroupDragEnd={
                  isGroupDrag && selectedIds.includes(element.id) ? handleGroupDragEnd : undefined
                }
              />
            ))}
            {draftElement && (
              <Group x={draftElement.x} y={draftElement.y} opacity={0.6} listening={false}>
                <ElementVisual element={draftElement} palette={palette} />
              </Group>
            )}
            {canEdit && tool === 'select' && selectedIds.length === 1 && (() => {
              const el = elements.find((e) => e.id === selectedIds[0]);
              if (!el || !isLineShape(el) || el.locked) return null;
              const [a, b] = lineDrag?.id === el.id ? [lineDrag.a, lineDrag.b] : lineEndpoints(el);
              const r = 9 / camera.scale;
              return (
                <>
                  {lineDrag?.id === el.id &&
                    elements.flatMap((t) =>
                      t.type === 'shape' && !isLineKind(t.kind) && t.id !== el.id
                        ? SIDES.map((side) => {
                            const p = anchorPoint(t, side);
                            return (
                              <Circle
                                key={`${t.id}:${side}`}
                                x={p.x}
                                y={p.y}
                                radius={5 / camera.scale}
                                fill={palette.accent}
                                opacity={0.55}
                                listening={false}
                              />
                            );
                          })
                        : [],
                    )}
                  {([['a', a], ['b', b]] as const).map(([end, p]) => (
                    <Circle
                      key={end}
                      x={p.x}
                      y={p.y}
                      radius={r}
                      fill="#ffffff"
                      stroke={palette.accent}
                      strokeWidth={2 / camera.scale}
                      draggable
                      onDragMove={(e) => dragLineEnd(el, end, { x: e.target.x(), y: e.target.y() })}
                      onDragEnd={commitLineDrag}
                      onPointerDown={(e) => {
                        e.cancelBubble = true;
                      }}
                    />
                  ))}
                </>
              );
            })()}
            {canEdit && tool === 'select' && (
              <Transformer
                ref={transformerRef}
                rotateEnabled
                resizeEnabled={resizeEnabled}
                keepRatio={keepRatio}
                padding={transformerPadding}
                ignoreStroke
                anchorCornerRadius={4}
                borderStroke={palette.accent}
                anchorStroke={palette.accent}
                anchorFill="#ffffff"
                boundBoxFunc={(oldBox, newBox) =>
                  !hasLine && (newBox.width < MIN_ELEMENT_SIZE || newBox.height < MIN_ELEMENT_SIZE)
                    ? oldBox
                    : newBox
                }
              />
            )}
          </Layer>
        </Stage>
      )}

      <canvas
        ref={inkRef}
        aria-hidden
        width={Math.max(1, Math.round(size.width * dpr))}
        height={Math.max(1, Math.round(size.height * dpr))}
        className="pointer-events-none absolute inset-0 h-full w-full"
      />

      {area && (
        <svg aria-hidden className="pointer-events-none absolute inset-0 h-full w-full">
          {area.kind === 'marquee' ? (
            (() => {
              const first = area.points[0]!;
              const last = area.points[area.points.length - 1]!;
              const x1 = first.x * camera.scale + camera.x;
              const y1 = first.y * camera.scale + camera.y;
              const x2 = last.x * camera.scale + camera.x;
              const y2 = last.y * camera.scale + camera.y;
              return (
                <rect
                  x={Math.min(x1, x2)}
                  y={Math.min(y1, y2)}
                  width={Math.abs(x2 - x1)}
                  height={Math.abs(y2 - y1)}
                  fill="var(--accent-from)"
                  fillOpacity={0.1}
                  stroke="var(--accent-from)"
                  strokeWidth={1.5}
                  strokeDasharray="6 4"
                  rx={3}
                />
              );
            })()
          ) : (
            <polygon
              points={area.points
                .map((p) => `${p.x * camera.scale + camera.x},${p.y * camera.scale + camera.y}`)
                .join(' ')}
              fill="var(--accent-from)"
              fillOpacity={0.1}
              stroke="var(--accent-from)"
              strokeWidth={2}
              strokeDasharray="7 5"
              strokeLinejoin="round"
            />
          )}
        </svg>
      )}

      {tool === 'erase' && eraserMode === 'precision' && (
        <div
          ref={eraseRing}
          aria-hidden
          className="pointer-events-none absolute left-0 top-0 rounded-full border-2 border-[var(--accent-from)] bg-[rgba(255,255,255,0.18)] opacity-0 shadow-[0_0_0_1px_rgba(0,0,0,0.25)]"
          style={{ width: eraserSize, height: eraserSize }}
        />
      )}

      {marqueeStyle && (
        <div
          aria-hidden
          className="pointer-events-none absolute rounded border border-[var(--accent-from)] bg-[rgba(var(--accent-from-rgb),0.08)]"
          style={marqueeStyle}
        />
      )}

      {size.width > 0 && size.height > 0 && (
        <TextLayer
          elements={elements}
          camera={camera}
          palette={palette}
          pageType={pageType}
          editingId={editingTextId}
          liveBox={liveBox}
          fragmentFor={fragmentFor}
          caretProvider={caretProvider}
          caretUser={caretUser}
          onBodyChange={onTextBodyChange}
          onResize={onTextResize}
          onExitEdit={onEndTextEdit}
        />
      )}

      {size.width > 0 && size.height > 0 && (
        <MediaLayer
          elements={elements}
          camera={camera}
          palette={palette}
          selectedId={primaryId}
          editing={canEdit}
          liveBox={liveBox}
        />
      )}

      {size.width > 0 && size.height > 0 && (
        <TableLayer
          elements={elements}
          camera={camera}
          palette={palette}
          selectedId={primaryId}
          editing={canEdit}
          liveBox={liveBox}
          onCommit={(id, next) =>
            onChangeElement(id, {
              rows: next.rows,
              cols: next.cols,
              cells: next.cells,
              colWidths: next.colWidths,
              hasHeaderRow: next.hasHeaderRow,
              width: next.width,
              height: next.height,
            })
          }
        />
      )}

      {editingShapeId && (
        <ShapeLabelEditor
          element={elements.find((e) => e.id === editingShapeId) ?? null}
          camera={camera}
          onCommit={onCommitShapeLabel}
          onClose={onEndShapeEdit}
        />
      )}

      {size.width > 0 && size.height > 0 && (
        <RemotePresenceLayer peers={remotePeers} camera={camera} elements={elements} />
      )}
    </div>
  );
}
