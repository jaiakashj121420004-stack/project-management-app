import { useEffect, useRef, useState } from 'react';
import { Stage, Layer, Path, Transformer } from 'react-konva';
import type Konva from 'konva';
import type { PageType } from '@/lib/canvasPages';
import { useElementSize } from '@/hooks/useElementSize';
import { ElementNode } from './elementRenderers';
import { PageBackground } from './PageBackground';
import { TextLayer } from './TextLayer';
import { MediaLayer } from './MediaLayer';
import { useCanvasPalette } from './useCanvasPalette';
import { strokePathData, type StrokeStyle } from './freehand';
import { penStrokeStyle, type PenSettings } from './drawing';
import {
  LONG_PRESS_MS,
  MIN_ELEMENT_SIZE,
  ZOOM_STEP,
  clampScale,
  type Camera,
  type CanvasTool,
  type ElementBox,
} from './constants';
import type { CanvasElement, ElementPatch } from './elements';

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
}

/** How long after the last pen event we keep rejecting touch (palm rejection). */
const PEN_ACTIVE_MS = 800;

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
function midpoint(a: { x: number; y: number }, b: { x: number; y: number }) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}
function pressureOf(evt: PointerEvent, isPen: boolean): number {
  if (!isPen) return 0.5;
  return evt.pressure > 0 ? evt.pressure : 0.5;
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
 * Palm rejection: once a pen is in use, touch is ignored for 800 ms.
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
  onPlaceText,
  editingTextId,
  onEditText,
  onEndTextEdit,
  onDropFiles,
  onContextMenu,
}: CanvasStageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const previewRef = useRef<Konva.Path>(null);
  const size = useElementSize(containerRef);
  const palette = useCanvasPalette(containerRef);

  // Live transform of the text/media box being dragged/resized so HTML overlays track it.
  const [liveBox, setLiveBox] = useState<ElementBox | null>(null);

  // Pinch bookkeeping (two-finger zoom/pan).
  const lastDist = useRef(0);
  const lastCenter = useRef<{ x: number; y: number } | null>(null);

  // Freehand stroke (world samples) and eraser gesture — refs to avoid
  // React renders on every pointer-move.
  const drawing = useRef<{ pointerId: number; points: number[]; style: StrokeStyle } | null>(null);
  const erasing = useRef(false);

  // Palm rejection.
  const penActive = useRef(false);
  const penTimer = useRef<number | null>(null);

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
    penActive.current = true;
    if (penTimer.current !== null) window.clearTimeout(penTimer.current);
    penTimer.current = window.setTimeout(() => { penActive.current = false; }, PEN_ACTIVE_MS);
  };

  useEffect(() => () => {
    if (penTimer.current !== null) window.clearTimeout(penTimer.current);
    if (longPressTimer.current !== null) window.clearTimeout(longPressTimer.current);
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

  function paintPreview() {
    const node = previewRef.current;
    const d = drawing.current;
    if (!node || !d) return;
    node.data(strokePathData(d.points, d.style));
    node.getLayer()?.batchDraw();
  }

  function clearPreview() {
    const node = previewRef.current;
    if (!node) return;
    node.data('');
    node.getLayer()?.batchDraw();
  }

  function startStroke(e: Konva.KonvaEventObject<PointerEvent>) {
    const isPen = e.evt.pointerType === 'pen';
    const start = toWorld(e.evt.clientX, e.evt.clientY);
    if (!start) return;
    const style = penStrokeStyle(penSettings, !isPen);
    drawing.current = { pointerId: e.evt.pointerId, points: [start.x, start.y, pressureOf(e.evt, isPen)], style };
    const node = previewRef.current;
    if (node) {
      node.fill(style.color);
      node.opacity(style.opacity);
      node.globalCompositeOperation(style.blend === 'multiply' ? 'multiply' : 'source-over');
    }
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

  function extendErase(evt: PointerEvent) {
    if (!erasing.current) return;
    if (evt.cancelable) evt.preventDefault();
    eraseAtScreen(evt.clientX, evt.clientY);
  }

  function endErase() {
    if (!erasing.current) return;
    erasing.current = false;
    endGestureListeners();
    onEraseEnd();
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

    if (tool === 'text') {
      const p = toWorld(e.evt.clientX, e.evt.clientY);
      if (p) onPlaceText(p.x, p.y);
      return;
    }

    if (tool !== 'draw' && tool !== 'erase') return;
    if (type === 'touch' && penActive.current) return;
    if (type === 'touch' && !e.evt.isPrimary) {
      cancelStroke();
      endErase();
      return;
    }
    if (e.evt.cancelable) e.evt.preventDefault();

    if (tool === 'draw') {
      startStroke(e);
    } else {
      erasing.current = true;
      startGestureListeners(extendErase, endErase, endErase);
      eraseAtScreen(e.evt.clientX, e.evt.clientY);
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

  function handleTouchStart(e: Konva.KonvaEventObject<TouchEvent>) {
    if (e.evt.touches.length >= 2) {
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

    const touches = e.evt.touches;
    if (touches.length < 2) return;
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
    if (e.evt.touches.length < 2) {
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
    if (e.target === stageRef.current) return;
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

  // derived state
  const primaryId = selectedIds[0] ?? null;
  const primaryElement = primaryId ? elements.find((el) => el.id === primaryId) : null;

  const keepRatio =
    primaryElement?.type === 'image' ||
    (primaryElement?.type === 'media' && primaryElement.kind === 'video');

  const transformerPadding = selectedIds.some(
    (id) => elements.find((el) => el.id === id)?.type === 'media',
  ) ? 6 : 0;

  const cursor =
    tool === 'draw' ? 'crosshair'
    : tool === 'erase' ? 'cell'
    : tool === 'text' ? 'text'
    : 'default';

  const isGroupDrag = selectedIds.length > 1;

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
      className="relative h-full w-full overflow-hidden rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-fill)]"
      style={{ touchAction: 'none', cursor }}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
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
          <Layer>
            {elements.map((element) => (
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
                  element.type === 'text' && canEdit && tool === 'select' && !element.locked
                    ? onEditText
                    : undefined
                }
                onLiveChange={
                  element.type === 'text' || element.type === 'media' ? setLiveBox : undefined
                }
                onGroupDragEnd={
                  isGroupDrag && selectedIds.includes(element.id) ? handleGroupDragEnd : undefined
                }
              />
            ))}
            {canEdit && tool === 'select' && (
              <Transformer
                ref={transformerRef}
                rotateEnabled
                keepRatio={keepRatio}
                padding={transformerPadding}
                ignoreStroke
                anchorCornerRadius={4}
                borderStroke={palette.accent}
                anchorStroke={palette.accent}
                anchorFill="#ffffff"
                boundBoxFunc={(oldBox, newBox) =>
                  newBox.width < MIN_ELEMENT_SIZE || newBox.height < MIN_ELEMENT_SIZE
                    ? oldBox
                    : newBox
                }
              />
            )}
          </Layer>
          <Layer listening={false}>
            <Path ref={previewRef} perfectDrawEnabled={false} shadowForStrokeEnabled={false} />
          </Layer>
        </Stage>
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
          onCommit={(id, body, text) => onChangeElement(id, { body, text })}
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
    </div>
  );
}
