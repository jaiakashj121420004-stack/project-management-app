import { useMemo } from 'react';
import { Group, Path, Rect, Text } from 'react-konva';
import type Konva from 'konva';
import { MIN_ELEMENT_SIZE } from './constants';
import type { CanvasElement, ElementPatch, StrokeElement } from './elements';
import { strokePathData } from './freehand';
import type { CanvasPalette } from './useCanvasPalette';

/**
 * Element renderers. Every element is a Konva <Group> positioned/rotated by its
 * transform box; strokes render their real perfect-freehand outline, while
 * text/image/media are still labelled placeholders (their bodies land in
 * P3.3–P3.5). The group carries id={element.id} so the stage's <Transformer>
 * attaches via stage.findOne('#id') and the eraser maps a hit back to its
 * element via findAncestor('.canvas-element').
 *
 * On drag/transform end we bake Konva's scale back into the model (resetting the
 * node scale to 1). A stroke has no inner geometry to stretch, so a resize is
 * baked into its sample points + width instead.
 */

type ElementChange = (id: string, patch: ElementPatch) => void;

interface ElementNodeProps {
  element: CanvasElement;
  /** Element can be dragged (select tool, editable, unlocked). */
  draggable: boolean;
  /** Clicking/tapping selects (select tool + editable) — off while drawing. */
  selectable: boolean;
  palette: CanvasPalette;
  onSelect: (id: string) => void;
  onChange: ElementChange;
}

export function ElementNode({
  element,
  draggable,
  selectable,
  palette,
  onSelect,
  onChange,
}: ElementNodeProps) {
  const select = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (!selectable) return;
    e.cancelBubble = true; // don't let the stage clear the selection
    onSelect(element.id);
  };

  const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    onChange(element.id, { x: e.target.x(), y: e.target.y() });
  };

  const handleTransformEnd = (e: Konva.KonvaEventObject<Event>) => {
    const node = e.target;
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    node.scaleX(1);
    node.scaleY(1);

    const base = {
      x: node.x(),
      y: node.y(),
      width: Math.max(MIN_ELEMENT_SIZE, element.width * Math.abs(scaleX)),
      height: Math.max(MIN_ELEMENT_SIZE, element.height * Math.abs(scaleY)),
      rotation: node.rotation(),
    };

    // A stroke has no inner shape to stretch — bake the resize into its sample
    // points + width so the recomputed outline matches the new box.
    if (element.type === 'stroke') {
      const uniform = (Math.abs(scaleX) + Math.abs(scaleY)) / 2;
      onChange(element.id, {
        ...base,
        points: scaleStrokePoints(element.points, scaleX, scaleY),
        size: Math.max(0.5, element.size * uniform),
      });
      return;
    }

    onChange(element.id, base);
  };

  return (
    <Group
      id={element.id}
      name="canvas-element"
      x={element.x}
      y={element.y}
      rotation={element.rotation}
      draggable={draggable}
      onClick={select}
      onTap={select}
      onDragEnd={handleDragEnd}
      onTransformEnd={handleTransformEnd}
    >
      <ElementVisual element={element} palette={palette} />
    </Group>
  );
}

/** Scale a stroke's flattened `[x, y, pressure, …]` samples (pure). */
function scaleStrokePoints(points: number[], scaleX: number, scaleY: number): number[] {
  const out: number[] = [];
  for (let i = 0; i + 1 < points.length; i += 3) {
    out.push((points[i] ?? 0) * scaleX, (points[i + 1] ?? 0) * scaleY, points[i + 2] ?? 0.5);
  }
  return out;
}

/** The body for each element type. */
function ElementVisual({ element, palette }: { element: CanvasElement; palette: CanvasPalette }) {
  if (element.type === 'stroke') {
    return <StrokeVisual element={element} />;
  }

  const { width, height } = element;
  const isEmptyText = element.type === 'text' && element.text.trim().length === 0;
  const label = stubLabel(element);

  return (
    <>
      <Rect
        width={width}
        height={height}
        cornerRadius={16}
        fill={palette.surface}
        stroke={palette.border}
        strokeWidth={1}
        dash={isEmptyText ? [6, 5] : undefined}
        perfectDrawEnabled={false}
      />
      <Text
        text={label}
        width={width}
        height={height}
        padding={12}
        fontSize={15}
        fontFamily="Inter, system-ui, sans-serif"
        fill={isEmptyText ? palette.muted : palette.text}
        align={element.type === 'text' ? 'left' : 'center'}
        verticalAlign={element.type === 'text' ? 'top' : 'middle'}
        wrap="word"
        ellipsis
        listening={false}
      />
    </>
  );
}

/** A committed stroke: its filled perfect-freehand outline, recomputed from the
 *  stored samples so it stays crisp at any zoom. The filled path is the hit
 *  target (precise selection + erase); multiply gives the highlighter its look. */
function StrokeVisual({ element }: { element: StrokeElement }) {
  const data = useMemo(
    () =>
      strokePathData(element.points, {
        size: element.size,
        thinning: element.thinning,
        smoothing: element.smoothing,
        simulatePressure: element.simulatePressure,
      }),
    [element.points, element.size, element.thinning, element.smoothing, element.simulatePressure],
  );
  if (!data) return null;
  return (
    <Path
      data={data}
      fill={element.color}
      opacity={element.opacity}
      globalCompositeOperation={element.blend === 'multiply' ? 'multiply' : 'source-over'}
      perfectDrawEnabled={false}
      shadowForStrokeEnabled={false}
    />
  );
}

function stubLabel(element: Exclude<CanvasElement, StrokeElement>): string {
  switch (element.type) {
    case 'text':
      return element.text.trim() || 'Text box';
    case 'image':
      return '🖼  Image';
    case 'media':
      return element.kind === 'audio' ? '🎙  Audio' : '🎬  Video';
  }
}
