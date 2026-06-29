import { useEffect, useRef, useState } from 'react';
import { Stage, Layer, Path, Transformer } from 'react-konva';
import type Konva from 'konva';
import type { PageType } from '@/lib/canvasPages';
import { useElementSize } from '@/hooks/useElementSize';
import { ElementNode } from './elementRenderers';
import { PageBackground } from './PageBackground';
import { TextLayer } from './TextLayer';
import { useCanvasPalette } from './useCanvasPalette';
import { strokePathData, type StrokeStyle } from './freehand';
import { penStrokeStyle, type PenSettings } from './drawing';
import {
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
  selectedId: string | null;
  camera: Camera;
  tool: CanvasTool;
  /** Editors transform/draw; viewers can still pan/zoom/select read-only. */
  canEdit: boolean;
  /** Live pen settings (drives the draw preview + the committed stroke style). */
  penSettings: PenSettings;
  onSelect: (id: string | null) => void;
  onChangeElement: (id: string, patch: ElementPatch) => void;
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
   * One or more image files were dropped onto the canvas. The world coordinates
   * are computed from the drop position using the current camera so the caller
   * can place the element exactly where the user dropped it.
   */
  onDropFiles?: (worldX: number, worldY: number, files: File[]) => void;
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
 *   - select — drag empty space pans (stage draggable); click/tap selects; the
 *     <Transformer> moves/resizes/rotates the selection.
 *   - draw   — pointer events build a pressure-sensitive stroke on a dedicated
 *     preview layer; on pointerup the world samples are committed to the scene.
 *   - erase  — pointer events hit-test strokes and remove them (batched per
 *     gesture so one undo restores them all).
 * Two-finger pan/zoom (pinch) and wheel-zoom work in every mode. Palm rejection:
 * once a pen is in use, touch is ignored so a resting palm can't draw or pan.
 */
export function CanvasStage({
  elements,
  pageType,
  selectedId,
  camera,
  tool,
  canEdit,
  penSettings,
  onSelect,
  onChangeElement,
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
}: CanvasStageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const previewRef = useRef<Konva.Path>(null);
  const size = useElementSize(containerRef);
  const palette = useCanvasPalette(containerRef);

  // Live transform of the text box being dragged/resized, so the HTML overlay
  // tracks the Konva node in real time (element state only updates on gesture
  // end). Null when no text box is mid-gesture.
  const [liveBox, setLiveBox] = useState<ElementBox | null>(null);

  // Pinch bookkeeping (two-finger zoom/pan).
  const lastDist = useRef(0);
  const lastCenter = useRef<{ x: number; y: number } | null>(null);

  // The in-progress freehand stroke (world samples) and eraser gesture. Kept in
  // refs so the hot pointer-move path never triggers a React render — the live
  // stroke is drawn imperatively onto the preview layer instead.
  const drawing = useRef<{ pointerId: number; points: number[]; style: StrokeStyle } | null>(null);
  const erasing = useRef(false);

  // Palm rejection: remember that a pen was recently used.
  const penActive = useRef(false);
  const penTimer = useRef<number | null>(null);

  const markPen = () => {
    penActive.current = true;
    if (penTimer.current !== null) window.clearTimeout(penTimer.current);
    penTimer.current = window.setTimeout(() => {
      penActive.current = false;
    }, PEN_ACTIVE_MS);
  };

  useEffect(
    () => () => {
      if (penTimer.current !== null) window.clearTimeout(penTimer.current);
    },
    [],
  );

  // Report the measured viewport up so the editor can place new elements at the
  // visible centre and drive zoom-button math.
  useEffect(() => {
    if (size.width > 0 && size.height > 0) onViewportChange(size);
  }, [size, onViewportChange]);

  // Attach/detach the transformer to the selected, unlocked, editable element —
  // only in select mode (no resize handles while drawing/erasing).
  useEffect(() => {
    const transformer = transformerRef.current;
    const stage = stageRef.current;
    if (!transformer || !stage) return;
    const selected = selectedId ? elements.find((el) => el.id === selectedId) : undefined;
    // No resize handles while a text box is being edited (the editor owns it).
    const attach =
      selected && !selected.locked && canEdit && tool === 'select' && editingTextId === null;
    const node = attach ? stage.findOne(`#${selectedId}`) : null;
    transformer.nodes(node ? [node] : []);
    transformer.getLayer()?.batchDraw();
  }, [selectedId, elements, canEdit, tool, editingTextId]);

  // --- coordinate helpers -----------------------------------------------------

  /** Convert client (screen) coordinates to world space via the camera. */
  function toWorld(clientX: number, clientY: number): { x: number; y: number } | null {
    const stage = stageRef.current;
    if (!stage) return null;
    const rect = stage.container().getBoundingClientRect();
    return {
      x: (clientX - rect.left - camera.x) / camera.scale,
      y: (clientY - rect.top - camera.y) / camera.scale,
    };
  }

  // Active draw/erase gestures listen on WINDOW for move/up/cancel rather than
  // relying on Konva's stage pointer events. Konva can miss `pointerup` on some
  // touchpads/styluses (which left strokes uncommitted — they'd vanish on the
  // next action). Window listeners always fire, so a gesture always ends and
  // commits. We keep a single teardown so a new gesture can't leak listeners.
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

  // Clean up any dangling gesture listeners on unmount.
  useEffect(() => () => endGestureListeners(), []);

  // --- drawing ---------------------------------------------------------------

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
    drawing.current = {
      pointerId: e.evt.pointerId,
      points: [start.x, start.y, pressureOf(e.evt, isPen)],
      style,
    };
    const node = previewRef.current;
    if (node) {
      node.fill(style.color);
      node.opacity(style.opacity);
      node.globalCompositeOperation(style.blend === 'multiply' ? 'multiply' : 'source-over');
    }
    paintPreview();
    // Track the rest of the gesture on window so a missed Konva pointerup can't
    // strand the stroke as an uncommitted preview.
    startGestureListeners(extendStroke, endStroke, cancelStroke);
  }

  function extendStroke(evt: PointerEvent) {
    const d = drawing.current;
    if (!d || evt.pointerId !== d.pointerId) return;
    if (evt.pointerType === 'pen') markPen();
    if (evt.cancelable) evt.preventDefault();
    const isPen = evt.pointerType === 'pen';
    // Coalesced events recover the full-rate samples a high-frequency stylus
    // produces between animation frames — markedly smoother on a tablet.
    const coalesced =
      typeof evt.getCoalescedEvents === 'function' ? evt.getCoalescedEvents() : [];
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

  // --- erasing ---------------------------------------------------------------

  /** Hit-test the element under a screen point (relative to the stage container)
   *  and queue it for erasing. Tries a few offsets so thin strokes are easy to
   *  hit even when the pointer isn't dead-centre on them. */
  function eraseAtScreen(screenX: number, screenY: number) {
    const stage = stageRef.current;
    if (!stage) return;
    const rect = stage.container().getBoundingClientRect();
    const base = { x: screenX - rect.left, y: screenY - rect.top };
    const r = 6; // forgiving hit radius (screen px)
    const probes = [
      base,
      { x: base.x - r, y: base.y },
      { x: base.x + r, y: base.y },
      { x: base.x, y: base.y - r },
      { x: base.x, y: base.y + r },
    ];
    for (const pos of probes) {
      const shape = stage.getIntersection(pos);
      const group = shape?.findAncestor('.canvas-element', true) as Konva.Node | undefined;
      if (group) {
        onEraseStroke(group.id());
        return;
      }
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

  // --- pointer routing -------------------------------------------------------
  // Only the gesture START is read from Konva; move/up/cancel are tracked on
  // window (see startGestureListeners) so a gesture can never be stranded.

  function handlePointerDown(e: Konva.KonvaEventObject<PointerEvent>) {
    if (!canEdit) return;
    const type = e.evt.pointerType;
    if (type === 'pen') markPen();

    // Text tool: a single click/tap drops a new text box at that world point.
    if (tool === 'text') {
      const p = toWorld(e.evt.clientX, e.evt.clientY);
      if (p) onPlaceText(p.x, p.y);
      return;
    }

    if (tool !== 'draw' && tool !== 'erase') return;
    // Palm rejection: ignore touch entirely while a pen is in use.
    if (type === 'touch' && penActive.current) return;
    // A second finger means a pinch — hand off to the pan/zoom path.
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

  // --- camera (wheel + pinch) + selection ------------------------------------

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

  // Pan: only react when the STAGE itself is the drag target (an element drag has
  // the element as target). We read the live node so the camera never goes stale.
  function syncStageCamera(e: Konva.KonvaEventObject<DragEvent>) {
    const stage = stageRef.current;
    if (!stage || e.target !== stage) return;
    onCameraChange({ x: stage.x(), y: stage.y(), scale: stage.scaleX() });
  }

  function handleMouseDown(e: Konva.KonvaEventObject<MouseEvent>) {
    if (tool === 'select' && e.target === stageRef.current) onSelect(null);
  }

  function handleTouchStart(e: Konva.KonvaEventObject<TouchEvent>) {
    if (e.evt.touches.length >= 2) {
      // A pinch is starting — abandon any in-progress draw/erase gesture.
      cancelStroke();
      endErase();
      stageRef.current?.stopDrag();
      lastDist.current = 0;
      lastCenter.current = null;
    } else if (tool === 'select' && e.target === stageRef.current) {
      onSelect(null);
    }
  }

  function handleTouchMove(e: Konva.KonvaEventObject<TouchEvent>) {
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
    if (e.evt.touches.length < 2) {
      lastDist.current = 0;
      lastCenter.current = null;
    }
  }

  // Keep the aspect ratio when transforming an image element (corner handles
  // maintain it by default; Shift allows free resize — standard image editor UX).
  // All other element types remain freely resizable.
  const selectedElement = selectedId ? elements.find((el) => el.id === selectedId) : null;
  const keepRatio = selectedElement?.type === 'image';

  const cursor =
    tool === 'draw'
      ? 'crosshair'
      : tool === 'erase'
        ? 'cell'
        : tool === 'text'
          ? 'text'
          : 'default';

  // ── HTML drag-drop (external files, e.g. from the file manager) ────────────
  // These are native DOM events, not Konva's own element-drag events.

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    // Allow the drop only when we have a file handler and there are image files.
    if (!onDropFiles) return;
    if (Array.from(e.dataTransfer.types).includes('Files')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    }
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    if (!onDropFiles || !containerRef.current) return;
    const files = Array.from(e.dataTransfer.files).filter((f) =>
      f.type.startsWith('image/'),
    );
    if (files.length === 0) return;
    const rect = containerRef.current.getBoundingClientRect();
    const worldX = (e.clientX - rect.left - camera.x) / camera.scale;
    const worldY = (e.clientY - rect.top - camera.y) / camera.scale;
    onDropFiles(worldX, worldY, files);
  }

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
          onDragMove={syncStageCamera}
          onDragEnd={syncStageCamera}
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
                onSelect={onSelect}
                onChange={onChangeElement}
                onRequestEdit={
                  element.type === 'text' && canEdit && tool === 'select' && !element.locked
                    ? onEditText
                    : undefined
                }
                onLiveChange={element.type === 'text' ? setLiveBox : undefined}
              />
            ))}
            {canEdit && tool === 'select' && (
              <Transformer
                ref={transformerRef}
                rotateEnabled
                keepRatio={keepRatio}
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
          {/* The in-progress stroke draws here imperatively (no React render per
              pointer-move). It's listening:false so it never blocks hit-testing. */}
          <Layer listening={false}>
            <Path ref={previewRef} perfectDrawEnabled={false} shadowForStrokeEnabled={false} />
          </Layer>
        </Stage>
      )}
      {/* Rich text lives in an HTML overlay above the Konva canvas — Konva can't
          render formatted text. It's click-through except the box being edited. */}
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
    </div>
  );
}
