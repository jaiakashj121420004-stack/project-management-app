import { Group, Rect, Text, Line } from 'react-konva';
import type Konva from 'konva';
import { MIN_ELEMENT_SIZE } from './constants';
import type { CanvasElement, CanvasElementBase } from './elements';
import type { CanvasPalette } from './useCanvasPalette';

/**
 * Element renderers (P3.1 — stubs). Every element is a draggable Konva <Group>
 * positioned/rotated by its transform box, with a type-specific visual sized to
 * width × height. The real bodies (freehand strokes, Tiptap text, images, media
 * players) land in P3.2–P3.5; here we render labelled placeholders so the
 * foundation's selection / move / resize / rotate all work end-to-end.
 *
 * The group carries id={element.id} so the stage's <Transformer> can attach via
 * stage.findOne('#id'). On drag/transform end we bake Konva's scale back into
 * width/height (resetting scale to 1) — the standard Konva resize pattern.
 */

type ElementChange = (id: string, patch: Partial<CanvasElementBase>) => void;

interface ElementNodeProps {
  element: CanvasElement;
  draggable: boolean;
  palette: CanvasPalette;
  onSelect: (id: string) => void;
  onChange: ElementChange;
}

export function ElementNode({ element, draggable, palette, onSelect, onChange }: ElementNodeProps) {
  const select = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
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
    onChange(element.id, {
      x: node.x(),
      y: node.y(),
      width: Math.max(MIN_ELEMENT_SIZE, element.width * scaleX),
      height: Math.max(MIN_ELEMENT_SIZE, element.height * scaleY),
      rotation: node.rotation(),
    });
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

/** The placeholder body for each element type. */
function ElementVisual({ element, palette }: { element: CanvasElement; palette: CanvasPalette }) {
  const { width, height } = element;

  // A real (already-drawn) stroke renders its polyline; an empty one falls
  // through to the labelled placeholder below.
  if (element.type === 'stroke' && element.points.length >= 4) {
    return (
      <>
        <Rect width={width} height={height} fill="transparent" />
        <Line
          points={element.points}
          stroke={element.color}
          strokeWidth={element.size}
          lineCap="round"
          lineJoin="round"
          tension={0.3}
          listening={false}
        />
      </>
    );
  }

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

function stubLabel(element: CanvasElement): string {
  switch (element.type) {
    case 'text':
      return element.text.trim() || 'Text box';
    case 'image':
      return '🖼  Image';
    case 'media':
      return element.kind === 'audio' ? '🎙  Audio' : '🎬  Video';
    case 'stroke':
      return 'Drawing';
  }
}
