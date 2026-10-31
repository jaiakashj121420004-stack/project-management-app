import type { CanvasScene, CanvasElement, ShapeKind } from './elements';
import { createClosedShape, createLineShape, rebindConnectors, type ShapeStyle } from './shapes';

const STYLE: ShapeStyle = { fill: 'none', stroke: '#7A2A26', strokeWidth: 3 };
const ARROW: ShapeStyle = { fill: 'none', stroke: '#7A2A26', strokeWidth: 3 };

interface Node {
  kind: ShapeKind;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

const NODES: readonly Node[] = [
  { kind: 'terminator', label: 'Start', x: 300, y: 0, w: 200, h: 80 },
  { kind: 'rect', label: 'Do the first step', x: 300, y: 160, w: 200, h: 90 },
  { kind: 'diamond', label: 'Done?', x: 290, y: 330, w: 220, h: 140 },
  { kind: 'rect', label: 'Fix and retry', x: 620, y: 355, w: 200, h: 90 },
  { kind: 'terminator', label: 'End', x: 300, y: 550, w: 200, h: 80 },
];

/** [from, fromSide, to, toSide] pairs wiring the starter nodes together. */
const EDGES: ReadonlyArray<readonly [number, string, number, string]> = [
  [0, 'bottom', 1, 'top'],
  [1, 'bottom', 2, 'top'],
  [2, 'right', 3, 'left'],
  [2, 'bottom', 4, 'top'],
];

/**
 * A ready-to-edit flowchart scene (start → step → decision → retry/end). Arrows
 * are glued to the shapes, so dragging a box keeps its connectors attached.
 */
export function flowchartStarterScene(): CanvasScene {
  const elements: CanvasElement[] = [];
  for (const node of NODES) {
    const shape = createClosedShape(
      node.kind,
      { x: node.x, y: node.y },
      { x: node.x + node.w, y: node.y + node.h },
      elements,
      STYLE,
    );
    elements.push({ ...shape, label: node.label });
  }
  const ids = elements.map((el) => el.id);
  for (const [from, fromSide, to, toSide] of EDGES) {
    const arrow = createLineShape('arrow', { x: 0, y: 0 }, { x: 100, y: 100 }, elements, ARROW);
    elements.push({ ...arrow, startBind: `${ids[from]}:${fromSide}`, endBind: `${ids[to]}:${toSide}` });
  }
  return { elements: rebindConnectors(elements) };
}
