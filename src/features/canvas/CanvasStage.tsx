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
  /** A stroke the eraser touched during the current gesture. */
  onEraseStroke: (id: string) => void;
  /** The eraser gesture ended — commit the batch as one undo step. */
  onEraseEnd: () => void;
  /** The text box currently open for editing (null = none). */
  editingTextId: string | null;
  /** Double-click/tap on a text box requests editing it. */
  onEditText: (id: string) => void;
  /** Leave text-edit mode (e.g. Escape inside the editor). */
  onEndTextEdit: () => void;
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
  editingTextId,
  onEditText,
  onEndTextEdit,
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

  function capturePointer(id: number) {
    try {
      stageRef.current?.container().setPointerCapture(id);
    } catch {
      // A stale/invalid pointer id — safe to ignore.
    }
  }
  function releasePointer(id: number) {
    try {
      stageRef.current?.container().releasePointerCapture(id);
    } catch {
      // Already released — ignore.
    }
  }

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
    capturePointer(e.evt.pointerId);
  }

  function extendStroke(e: Konva.KonvaEventObject<PointerEvent>) {
    const d = drawing.current;
    if (!d || e.evt.pointerId !== d.pointerId) return;
    const isPen = e.evt.pointerType === 'pen';
    // Coalesced events recover the full-rate samples a high-frequency stylus
    // produces between animation frames — markedly smoother on a tablet.
    const native = e.evt;
    const coalesced =
      typeof native.getCoalescedEvents === 'function' ? native.getCoalescedEvents() : [];
    const events = coalesced.length > 0 ? coalesced : [native];
    for (const ev of events) {
      const p = toWorld(ev.clientX, ev.clientY);
      if (!p) continue;
      d.points.push(p.x, p.y, pressureOf(ev, isPen));
    }
    paintPreview();
  }

  function endStroke(e: Konva.KonvaEventObject<PointerEvent>) {
    const d = drawing.current;
    if (!d || e.evt.pointerId !== d.pointerId) return;
    drawing.current = null;
    releasePointer(d.pointerId);
    clearPreview();
    if (d.points.length >= 3) onCommitStroke(d.points, d.style);
  }

  function cancelStroke() {
    if (!drawing.current) return;
    releasePointer(drawing.current.pointerId);
    drawing.current = null;
    clearPreview();
  }

  // --- erasing ---------------------------------------------------------------

  function eraseAt() {
    const stage = stageRef.current;
    if (!stage) return;
    const pos = stage.getPointerPosition();
    if (!pos) return;
    const shape = stage.getIntersection(pos);
    if (!shape) return;
    const group = shape.findAncestor('.canvas-element', true) as Konva.Node | undefined;
    if (group) onEraseStroke(group.id());
  }

  function endErase(pointerId: number) {
    if (!erasing.current) return;
    erasing.current = false;
    releasePointer(pointerId);
    onEraseEnd();
  }

  // --- pointer routing -------------------------------------------------------

  function handlePointerDown(e: Konva.KonvaEventObject<PointerEvent>) {
    if (!canEdit || (tool !== 'draw' && tool !== 'erase')) return;
    const type = e.evt.pointerType;
    if (type === 'pen') markPen();
    // Palm rejection: ignore touch entirely while a pen is in use.
    if (type === 'touch' && penActive.current) return;
    // A second finger means a pinch — hand off to the pan/zoom path.
    if (type === 'touch' && !e.evt.isPrimary) {
      cancelStroke();
      return;
    }
    e.evt.preventDefault();
    if (tool === 'draw') {
      startStroke(e);
    } else {
      erasing.current = true;
      capturePointer(e.evt.pointerId);
      eraseAt();
    }
  }

  function handlePointerMove(e: Konva.KonvaEventObject<PointerEvent>) {
    if (tool === 'draw' && drawing.current) {
      if (e.evt.pointerType === 'pen') markPen();
      e.evt.preventDefault();
      extendStroke(e);
    } else if (tool === 'erase' && erasing.current) {
      e.evt.preventDefault();
      eraseAt();
    }
  }

  function handlePointerUp(e: Konva.KonvaEventObject<PointerEvent>) {
    if (tool === 'draw') endStroke(e);
    else if (tool === 'erase') endErase(e.evt.pointerId);
  }

  function handlePointerCancel(e: Konva.KonvaEventObject<PointerEvent>) {
    if (tool === 'draw') cancelStroke();
    else if (tool === 'erase') endErase(e.evt.pointerId);
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
      if (erasing.current) endErase(0);
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

  const cursor = tool === 'draw' ? 'crosshair' : tool === 'erase' ? 'cell' : 'default';

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-fill)]"
      style={{ touchAction: 'none', cursor }}
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
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
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
                keepRatio={false}
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
          editingId={editingTextId}
          liveBox={liveBox}
          onCommit={(id, body, text) => onChangeElement(id, { body, text })}
          onExitEdit={onEndTextEdit}
        />
      )}
    </div>
  );
}
