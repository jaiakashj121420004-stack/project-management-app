import { useEffect, useRef } from 'react';
import { Stage, Layer, Transformer } from 'react-konva';
import type Konva from 'konva';
import type { PageType } from '@/lib/canvasPages';
import { useElementSize } from '@/hooks/useElementSize';
import { ElementNode } from './elementRenderers';
import { PageBackground } from './PageBackground';
import { useCanvasPalette } from './useCanvasPalette';
import {
  MIN_ELEMENT_SIZE,
  ZOOM_STEP,
  clampScale,
  type Camera,
  type CanvasTool,
} from './constants';
import type { CanvasElement, CanvasElementBase } from './elements';

interface CanvasStageProps {
  elements: CanvasElement[];
  pageType: PageType;
  selectedId: string | null;
  camera: Camera;
  tool: CanvasTool;
  /** Editors transform elements; viewers can still pan/zoom/select read-only. */
  canEdit: boolean;
  onSelect: (id: string | null) => void;
  onChangeElement: (id: string, patch: Partial<CanvasElementBase>) => void;
  onCameraChange: (camera: Camera) => void;
  onViewportChange: (size: { width: number; height: number }) => void;
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
function midpoint(a: { x: number; y: number }, b: { x: number; y: number }) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/**
 * The infinite, pan/zoom Konva stage. The stage transform (x/y/scale) IS the
 * camera; the background + elements live in world space inside it. Interaction:
 *   - wheel → zoom toward the pointer; pinch (2 touches) → zoom + pan;
 *   - drag empty space (mouse or 1 touch) → pan (the stage is draggable; the
 *     background is listening:false so empty hits reach the stage);
 *   - click/tap an element → select; click/tap empty → deselect.
 * Element move/resize/rotate go through the <Transformer> + each element's own
 * drag. Touch + stylus + mouse all share these pointer paths.
 */
export function CanvasStage({
  elements,
  pageType,
  selectedId,
  camera,
  tool,
  canEdit,
  onSelect,
  onChangeElement,
  onCameraChange,
  onViewportChange,
}: CanvasStageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const size = useElementSize(containerRef);
  const palette = useCanvasPalette(containerRef);

  // Pinch bookkeeping (two-finger zoom/pan).
  const lastDist = useRef(0);
  const lastCenter = useRef<{ x: number; y: number } | null>(null);

  // Report the measured viewport up so the editor can place new elements at the
  // visible centre and drive zoom-button math.
  useEffect(() => {
    if (size.width > 0 && size.height > 0) onViewportChange(size);
  }, [size, onViewportChange]);

  // Attach/detach the transformer to the selected, unlocked, editable element.
  useEffect(() => {
    const transformer = transformerRef.current;
    const stage = stageRef.current;
    if (!transformer || !stage) return;
    const selected = selectedId ? elements.find((el) => el.id === selectedId) : undefined;
    const node = selected && !selected.locked && canEdit ? stage.findOne(`#${selectedId}`) : null;
    transformer.nodes(node ? [node] : []);
    transformer.getLayer()?.batchDraw();
  }, [selectedId, elements, canEdit]);

  function zoomToPoint(pointer: { x: number; y: number }, nextScale: number) {
    const scale = clampScale(nextScale);
    const worldX = (pointer.x - camera.x) / camera.scale;
    const worldY = (pointer.y - camera.y) / camera.scale;
    onCameraChange({
      scale,
      x: pointer.x - worldX * scale,
      y: pointer.y - worldY * scale,
    });
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
    if (e.target === stageRef.current) onSelect(null);
  }

  function handleTouchStart(e: Konva.KonvaEventObject<TouchEvent>) {
    if (e.evt.touches.length >= 2) {
      stageRef.current?.stopDrag();
      lastDist.current = 0;
      lastCenter.current = null;
    } else if (e.target === stageRef.current) {
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

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-fill)]"
      style={{ touchAction: 'none' }}
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
                draggable={canEdit && tool === 'select' && !element.locked}
                palette={palette}
                onSelect={onSelect}
                onChange={onChangeElement}
              />
            ))}
            {canEdit && (
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
        </Stage>
      )}
    </div>
  );
}
