/**
 * shapes.ts — the shape / flowchart / arrow vocabulary (pure geometry, no React).
 *
 * Closed shapes are drawn from an SVG path generated for the element's current
 * width × height, so they resize crisply without baking any scale. Lines keep
 * two endpoints in `pts`. Connection points let an arrow glue itself to a box.
 */
import { topZ } from './elements';
import type { CanvasElement, ShapeElement, ShapeKind } from './elements';

export const LINE_KINDS: readonly ShapeKind[] = ['line', 'arrow', 'double-arrow', 'elbow-arrow'];

export function isLineKind(kind: ShapeKind): boolean {
  return LINE_KINDS.includes(kind);
}

export function isLineShape(el: CanvasElement): el is ShapeElement {
  return el.type === 'shape' && isLineKind(el.kind);
}

export interface ShapeCatalogItem {
  kind: ShapeKind;
  label: string;
}
export interface ShapeCatalogGroup {
  id: string;
  label: string;
  items: ShapeCatalogItem[];
}

/** The picker's contents, grouped the way people think about them. */
export const SHAPE_CATALOG: readonly ShapeCatalogGroup[] = [
  {
    id: 'lines',
    label: 'Lines & arrows',
    items: [
      { kind: 'line', label: 'Line' },
      { kind: 'arrow', label: 'Arrow' },
      { kind: 'double-arrow', label: 'Two-way arrow' },
      { kind: 'elbow-arrow', label: 'Elbow arrow' },
    ],
  },
  {
    id: 'basic',
    label: 'Shapes',
    items: [
      { kind: 'rect', label: 'Rectangle' },
      { kind: 'rounded', label: 'Rounded box' },
      { kind: 'ellipse', label: 'Circle / oval' },
      { kind: 'triangle', label: 'Triangle' },
      { kind: 'hexagon', label: 'Hexagon' },
      { kind: 'star', label: 'Star' },
      { kind: 'callout', label: 'Speech bubble' },
      { kind: 'sticky', label: 'Sticky note' },
    ],
  },
  {
    id: 'flow',
    label: 'Flowchart',
    items: [
      { kind: 'terminator', label: 'Start / End' },
      { kind: 'rect', label: 'Process' },
      { kind: 'diamond', label: 'Decision' },
      { kind: 'parallelogram', label: 'Input / Output' },
      { kind: 'document', label: 'Document' },
      { kind: 'cylinder', label: 'Database' },
    ],
  },
  {
    id: 'symbols',
    label: 'Symbols',
    items: [
      { kind: 'check', label: 'Tick' },
      { kind: 'cross', label: 'Cross' },
      { kind: 'plus', label: 'Plus' },
      { kind: 'heart', label: 'Heart' },
    ],
  },
];

const LABELS: Record<ShapeKind, string> = {
  rect: 'Rectangle',
  rounded: 'Rounded box',
  ellipse: 'Oval',
  triangle: 'Triangle',
  diamond: 'Decision',
  hexagon: 'Hexagon',
  star: 'Star',
  parallelogram: 'Input / Output',
  terminator: 'Start / End',
  document: 'Document',
  cylinder: 'Database',
  callout: 'Speech bubble',
  sticky: 'Sticky note',
  plus: 'Plus',
  check: 'Tick',
  cross: 'Cross',
  heart: 'Heart',
  line: 'Line',
  arrow: 'Arrow',
  'double-arrow': 'Two-way arrow',
  'elbow-arrow': 'Elbow arrow',
};

export function shapeLabel(kind: ShapeKind): string {
  return LABELS[kind];
}

/** Natural size when the user just clicks (no drag) with a shape tool. */
export function defaultShapeSize(kind: ShapeKind): { width: number; height: number } {
  switch (kind) {
    case 'sticky':
      return { width: 180, height: 180 };
    case 'terminator':
    case 'parallelogram':
    case 'document':
      return { width: 190, height: 90 };
    case 'diamond':
      return { width: 170, height: 120 };
    case 'cylinder':
      return { width: 120, height: 140 };
    case 'check':
    case 'cross':
    case 'plus':
    case 'heart':
    case 'star':
      return { width: 90, height: 90 };
    default:
      return { width: 170, height: 110 };
  }
}

/** Sticky notes are yellow paper; everything else starts as a calm, light fill. */
const STICKY_FILL = '#fde68a';

function r(n: number): number {
  return Math.round(n * 100) / 100;
}

/** SVG path data for a CLOSED shape filling a w × h box. '' for lines. */
export function shapePathData(kind: ShapeKind, w: number, h: number): string {
  const cx = w / 2;
  const cy = h / 2;
  switch (kind) {
    case 'rect':
    case 'sticky':
      return `M0 0H${r(w)}V${r(h)}H0Z`;
    case 'rounded': {
      const k = Math.min(18, w / 4, h / 4);
      return `M${k} 0H${r(w - k)}Q${r(w)} 0 ${r(w)} ${k}V${r(h - k)}Q${r(w)} ${r(h)} ${r(w - k)} ${r(h)}H${k}Q0 ${r(h)} 0 ${r(h - k)}V${k}Q0 0 ${k} 0Z`;
    }
    case 'terminator': {
      const k = h / 2;
      return `M${r(k)} 0H${r(w - k)}A${r(k)} ${r(k)} 0 0 1 ${r(w - k)} ${r(h)}H${r(k)}A${r(k)} ${r(k)} 0 0 1 ${r(k)} 0Z`;
    }
    case 'ellipse':
      return `M0 ${r(cy)}A${r(cx)} ${r(cy)} 0 1 1 ${r(w)} ${r(cy)}A${r(cx)} ${r(cy)} 0 1 1 0 ${r(cy)}Z`;
    case 'triangle':
      return `M${r(cx)} 0L${r(w)} ${r(h)}H0Z`;
    case 'diamond':
      return `M${r(cx)} 0L${r(w)} ${r(cy)}L${r(cx)} ${r(h)}L0 ${r(cy)}Z`;
    case 'hexagon': {
      const k = w * 0.25;
      return `M${r(k)} 0H${r(w - k)}L${r(w)} ${r(cy)}L${r(w - k)} ${r(h)}H${r(k)}L0 ${r(cy)}Z`;
    }
    case 'parallelogram': {
      const k = w * 0.2;
      return `M${r(k)} 0H${r(w)}L${r(w - k)} ${r(h)}H0Z`;
    }
    case 'star': {
      const pts: string[] = [];
      for (let i = 0; i < 10; i += 1) {
        const radius = i % 2 === 0 ? 1 : 0.42;
        const a = (Math.PI / 5) * i - Math.PI / 2;
        pts.push(`${r(cx + Math.cos(a) * radius * cx)} ${r(cy + Math.sin(a) * radius * cy)}`);
      }
      return `M${pts.join('L')}Z`;
    }
    case 'document': {
      const wave = h * 0.14;
      return `M0 0H${r(w)}V${r(h - wave)}Q${r(w * 0.75)} ${r(h - wave * 2.4)} ${r(cx)} ${r(h - wave)}T0 ${r(h - wave)}Z`;
    }
    case 'cylinder': {
      const e = Math.min(h * 0.16, w * 0.3);
      return `M0 ${r(e)}A${r(cx)} ${r(e)} 0 0 1 ${r(w)} ${r(e)}V${r(h - e)}A${r(cx)} ${r(e)} 0 0 1 0 ${r(h - e)}Z M0 ${r(e)}A${r(cx)} ${r(e)} 0 0 0 ${r(w)} ${r(e)}`;
    }
    case 'callout': {
      const tail = h * 0.22;
      const bodyH = h - tail;
      return `M0 0H${r(w)}V${r(bodyH)}H${r(w * 0.42)}L${r(w * 0.2)} ${r(h)}L${r(w * 0.26)} ${r(bodyH)}H0Z`;
    }
    case 'plus': {
      const t = Math.min(w, h) * 0.34;
      return `M${r(cx - t / 2)} 0H${r(cx + t / 2)}V${r(cy - t / 2)}H${r(w)}V${r(cy + t / 2)}H${r(cx + t / 2)}V${r(h)}H${r(cx - t / 2)}V${r(cy + t / 2)}H0V${r(cy - t / 2)}H${r(cx - t / 2)}Z`;
    }
    case 'cross': {
      const t = Math.min(w, h) * 0.26;
      return `M${r(t)} 0L${r(cx)} ${r(cy - t)}L${r(w - t)} 0L${r(w)} ${r(t)}L${r(cx + t)} ${r(cy)}L${r(w)} ${r(h - t)}L${r(w - t)} ${r(h)}L${r(cx)} ${r(cy + t)}L${r(t)} ${r(h)}L0 ${r(h - t)}L${r(cx - t)} ${r(cy)}L0 ${r(t)}Z`;
    }
    case 'check':
      return `M${r(w * 0.04)} ${r(h * 0.55)}L${r(w * 0.18)} ${r(h * 0.4)}L${r(w * 0.4)} ${r(h * 0.62)}L${r(w * 0.82)} ${r(h * 0.1)}L${r(w * 0.96)} ${r(h * 0.25)}L${r(w * 0.4)} ${r(h * 0.92)}Z`;
    case 'heart':
      return `M${r(cx)} ${r(h)}C${r(-w * 0.1)} ${r(h * 0.55)} ${r(w * 0.1)} ${r(-h * 0.05)} ${r(cx)} ${r(h * 0.28)}C${r(w * 0.9)} ${r(-h * 0.05)} ${r(w * 1.1)} ${r(h * 0.55)} ${r(cx)} ${r(h)}Z`;
    default:
      return '';
  }
}

/** Where the text sits inside a shape (a little inset from its outline). */
export function labelBox(el: ShapeElement): { x: number; y: number; width: number; height: number } {
  const inset = el.kind === 'ellipse' || el.kind === 'diamond' || el.kind === 'star' || el.kind === 'heart' || el.kind === 'triangle' ? 0.2 : 0.06;
  const dx = el.width * inset;
  const dy = el.height * inset;
  const lower = el.kind === 'triangle' ? el.height * 0.25 : 0;
  const bottomLoss = el.kind === 'callout' ? el.height * 0.22 : el.kind === 'document' ? el.height * 0.14 : 0;
  return {
    x: dx,
    y: dy + lower,
    width: Math.max(10, el.width - dx * 2),
    height: Math.max(10, el.height - dy * 2 - lower - bottomLoss),
  };
}

/** Readable label size for a shape of this box. */
export function labelFontSize(el: ShapeElement): number {
  return Math.round(Math.max(12, Math.min(26, Math.min(el.width, el.height) / 5.5)));
}

// ── lines ────────────────────────────────────────────────────────────────────

export interface Point {
  x: number;
  y: number;
}

/** Re-base a line's world endpoints into a min-corner box + local `pts`. */
export function lineGeometry(
  a: Point,
  b: Point,
): { x: number; y: number; width: number; height: number; pts: number[] } {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return {
    x,
    y,
    width: Math.abs(a.x - b.x),
    height: Math.abs(a.y - b.y),
    pts: [a.x - x, a.y - y, b.x - x, b.y - y],
  };
}

/** A line's two endpoints in WORLD space (honours the element's rotation about x,y). */
export function lineEndpoints(el: ShapeElement): [Point, Point] {
  const rad = (el.rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const at = (lx: number, ly: number): Point => ({
    x: el.x + lx * cos - ly * sin,
    y: el.y + lx * sin + ly * cos,
  });
  return [at(el.pts[0] ?? 0, el.pts[1] ?? 0), at(el.pts[2] ?? 0, el.pts[3] ?? 0)];
}

/** The polyline a line element is drawn along, in its local space. */
export function linePolyline(el: ShapeElement): number[] {
  const [x1, y1, x2, y2] = [el.pts[0] ?? 0, el.pts[1] ?? 0, el.pts[2] ?? 0, el.pts[3] ?? 0];
  if (el.kind === 'elbow-arrow') {
    const horizontalFirst = Math.abs(x2 - x1) >= Math.abs(y2 - y1);
    return horizontalFirst
      ? [x1, y1, (x1 + x2) / 2, y1, (x1 + x2) / 2, y2, x2, y2]
      : [x1, y1, x1, (y1 + y2) / 2, x2, (y1 + y2) / 2, x2, y2];
  }
  return [x1, y1, x2, y2];
}

export function hasStartHead(kind: ShapeKind): boolean {
  return kind === 'double-arrow';
}
export function hasEndHead(kind: ShapeKind): boolean {
  return kind === 'arrow' || kind === 'double-arrow' || kind === 'elbow-arrow';
}

// ── construction ─────────────────────────────────────────────────────────────

export interface ShapeStyle {
  fill: string;
  stroke: string;
  strokeWidth: number;
}

/** Default colours that read on both the light and dark canvas. */
export function defaultShapeStyle(kind: ShapeKind, ink: string): ShapeStyle {
  if (isLineKind(kind)) return { fill: 'none', stroke: ink, strokeWidth: 3 };
  if (kind === 'sticky') return { fill: STICKY_FILL, stroke: '#d4a82a', strokeWidth: 1 };
  if (kind === 'check') return { fill: '#22c55e', stroke: '#15803d', strokeWidth: 2 };
  if (kind === 'cross') return { fill: '#ef4444', stroke: '#b91c1c', strokeWidth: 2 };
  if (kind === 'heart') return { fill: '#ec4899', stroke: '#be185d', strokeWidth: 2 };
  if (kind === 'star') return { fill: '#fbbf24', stroke: '#b45309', strokeWidth: 2 };
  return { fill: 'none', stroke: ink, strokeWidth: 3 };
}

function baseShape(kind: ShapeKind, style: ShapeStyle, z: number): Omit<ShapeElement, 'x' | 'y' | 'width' | 'height' | 'pts'> {
  return {
    id: crypto.randomUUID(),
    type: 'shape',
    kind,
    rotation: 0,
    z,
    locked: false,
    visible: true,
    fill: style.fill,
    stroke: style.stroke,
    strokeWidth: style.strokeWidth,
    dash: 'solid',
    label: '',
    startBind: null,
    endBind: null,
  };
}

/** A closed shape filling the box dragged from a to b (normalised, min-sized). */
export function createClosedShape(
  kind: ShapeKind,
  a: Point,
  b: Point,
  existing: readonly CanvasElement[],
  style: ShapeStyle,
): ShapeElement {
  const drag = Math.hypot(a.x - b.x, a.y - b.y);
  const size = drag < 8 ? defaultShapeSize(kind) : null;
  const width = size ? size.width : Math.max(24, Math.abs(a.x - b.x));
  const height = size ? size.height : Math.max(24, Math.abs(a.y - b.y));
  const x = size ? a.x - width / 2 : Math.min(a.x, b.x);
  const y = size ? a.y - height / 2 : Math.min(a.y, b.y);
  return { ...baseShape(kind, style, topZ(existing)), x, y, width, height, pts: [] };
}

/** A line/arrow from a to b (a click without a drag makes a short horizontal one). */
export function createLineShape(
  kind: ShapeKind,
  a: Point,
  b: Point,
  existing: readonly CanvasElement[],
  style: ShapeStyle,
): ShapeElement {
  const end = Math.hypot(a.x - b.x, a.y - b.y) < 8 ? { x: a.x + 160, y: a.y } : b;
  const geo = lineGeometry(a, end);
  return { ...baseShape(kind, style, topZ(existing)), ...geo };
}

// ── connectors glued to shapes ───────────────────────────────────────────────

export type Side = 'top' | 'right' | 'bottom' | 'left';
export const SIDES: readonly Side[] = ['top', 'right', 'bottom', 'left'];

/** The world position of a shape's connection point on `side` (rotation-aware). */
export function anchorPoint(el: CanvasElement, side: Side): Point {
  const lx = side === 'left' ? 0 : side === 'right' ? el.width : el.width / 2;
  const ly = side === 'top' ? 0 : side === 'bottom' ? el.height : el.height / 2;
  const rad = (el.rotation * Math.PI) / 180;
  return {
    x: el.x + lx * Math.cos(rad) - ly * Math.sin(rad),
    y: el.y + lx * Math.sin(rad) + ly * Math.cos(rad),
  };
}

/** Nearest connection point of any closed shape within `reach` of p, if any. */
export function snapToShape(
  p: Point,
  elements: readonly CanvasElement[],
  reach: number,
  ignoreId?: string,
): { point: Point; bind: string } | null {
  let best: { point: Point; bind: string; d: number } | null = null;
  for (const el of elements) {
    if (el.type !== 'shape' || isLineKind(el.kind) || el.id === ignoreId || el.visible === false) continue;
    for (const side of SIDES) {
      const point = anchorPoint(el, side);
      const d = Math.hypot(point.x - p.x, point.y - p.y);
      if (d <= reach && (!best || d < best.d)) best = { point, bind: `${el.id}:${side}`, d };
    }
  }
  return best ? { point: best.point, bind: best.bind } : null;
}

function resolveBind(bind: string | null, elements: readonly CanvasElement[]): Point | null {
  if (!bind) return null;
  const [id, side] = bind.split(':');
  const target = elements.find((el) => el.id === id);
  if (!target || !SIDES.includes(side as Side)) return null;
  return anchorPoint(target, side as Side);
}

/**
 * Re-aim every glued connector at its shapes' current positions. Returns the
 * SAME array when nothing needed to move (cheap to call after any edit).
 */
export function rebindConnectors(elements: CanvasElement[]): CanvasElement[] {
  let changed = false;
  const next = elements.map((el) => {
    if (!isLineShape(el) || (!el.startBind && !el.endBind)) return el;
    const [s0, e0] = lineEndpoints(el);
    const s = resolveBind(el.startBind, elements) ?? s0;
    const e = resolveBind(el.endBind, elements) ?? e0;
    if (Math.abs(s.x - s0.x) + Math.abs(s.y - s0.y) + Math.abs(e.x - e0.x) + Math.abs(e.y - e0.y) < 0.01) {
      return el;
    }
    changed = true;
    return { ...el, ...lineGeometry(s, e), rotation: 0 };
  });
  return changed ? next : elements;
}
