/**
 * pdfExtract.ts — read a PDF into plain geometry: positioned text blocks and
 * vector ink paths, per page, in a top-left-origin page space (1 unit = 1 pt).
 *
 * Pure over a pdf.js module passed in (so the browser can lazy-load the real
 * build and tests can use the Node build). No React, no DOM.
 *
 * Text: pdf.js text items are clustered into lines, then lines into paragraph
 * blocks. Ink: the operator list is walked while tracking the current transform
 * matrix, stroke colour/width/alpha; every stroked sub-path becomes one InkPath.
 * Apps like Notability export handwriting as vector strokes, which is what makes
 * it editable; a scanned/flattened PDF has neither text nor paths.
 */

export interface PdfTextBlock {
  x: number;
  /** Top edge of the first line. */
  y: number;
  width: number;
  fontSize: number;
  /** Reflowed paragraph text. */
  text: string;
  lineCount: number;
}

export interface PdfInkPath {
  /** Flattened `[x, y, x, y, …]` in page space. */
  points: number[];
  width: number;
  color: string;
  alpha: number;
}

export interface PdfPageData {
  width: number;
  height: number;
  blocks: PdfTextBlock[];
  ink: PdfInkPath[];
}

export interface PdfExtraction {
  pages: PdfPageData[];
  /** True when the page or ink caps cut content off. */
  truncated: boolean;
}

export const MAX_PDF_PAGES = 100;
export const MAX_INK_PATHS = 8000;

type Matrix = [number, number, number, number, number, number];

/** Minimal slice of the pdf.js API this module uses. */
export interface PdfJsLike {
  OPS: Record<string, number>;
  getDocument(src: { data: Uint8Array }): { promise: Promise<PdfDocumentLike> };
}
interface PdfDocumentLike {
  numPages: number;
  getPage(n: number): Promise<PdfPageLike>;
  destroy?: () => Promise<void> | void;
}
interface PdfPageLike {
  getViewport(opts: { scale: number }): { width: number; height: number; transform: number[] };
  getTextContent(): Promise<{ items: unknown[] }>;
  getOperatorList(): Promise<{ fnArray: number[]; argsArray: unknown[] }>;
}

interface RawItem {
  str: string;
  x: number;
  y: number;
  width: number;
  size: number;
}

const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

/** a × b in pdf.js order: apply b first, then a. */
function mul(a: ArrayLike<number>, b: ArrayLike<number>): Matrix {
  return [
    a[0]! * b[0]! + a[2]! * b[1]!,
    a[1]! * b[0]! + a[3]! * b[1]!,
    a[0]! * b[2]! + a[2]! * b[3]!,
    a[1]! * b[2]! + a[3]! * b[3]!,
    a[0]! * b[4]! + a[2]! * b[5]! + a[4]!,
    a[1]! * b[4]! + a[3]! * b[5]! + a[5]!,
  ];
}

function apply(m: ArrayLike<number>, x: number, y: number): [number, number] {
  return [m[0]! * x + m[2]! * y + m[4]!, m[1]! * x + m[3]! * y + m[5]!];
}

function isTextItem(item: unknown): item is { str: string; width: number; transform: number[] } {
  if (!item || typeof item !== 'object') return false;
  const rec = item as Record<string, unknown>;
  return typeof rec.str === 'string' && Array.isArray(rec.transform) && typeof rec.width === 'number';
}

// ── Text ────────────────────────────────────────────────────────────────────

function toRawItems(items: unknown[], viewport: { transform: number[] }): RawItem[] {
  const out: RawItem[] = [];
  for (const item of items) {
    if (!isTextItem(item) || item.str.trim().length === 0) continue;
    const tr = item.transform;
    const size = Math.hypot(tr[2]!, tr[3]!);
    // Skip rotated text: its line geometry would corrupt the clustering.
    if (size < 1 || Math.abs(tr[1]!) > size * 0.2) continue;
    const [x, y] = apply(viewport.transform, tr[4]!, tr[5]!);
    out.push({ str: item.str, x, y, width: item.width, size });
  }
  return out;
}

interface Line {
  x: number;
  right: number;
  /** Baseline y (top-origin). */
  y: number;
  size: number;
  text: string;
}

function toLines(items: RawItem[]): Line[] {
  const sorted = [...items].sort((a, b) => a.y - b.y || a.x - b.x);
  const groups: RawItem[][] = [];
  for (const item of sorted) {
    const last = groups[groups.length - 1];
    const ref = last?.[0];
    if (last && ref && Math.abs(item.y - ref.y) < Math.max(item.size, ref.size) * 0.4) last.push(item);
    else groups.push([item]);
  }
  return groups.map((group) => {
    group.sort((a, b) => a.x - b.x);
    let text = '';
    let prevEnd = 0;
    group.forEach((item, index) => {
      const needsSpace =
        index > 0 && item.x - prevEnd > item.size * 0.2 && !/\s$/.test(text) && !/^\s/.test(item.str);
      text += (needsSpace ? ' ' : '') + item.str;
      prevEnd = item.x + item.width;
    });
    const first = group[0]!;
    const size = Math.max(...group.map((item) => item.size));
    return { x: first.x, right: prevEnd, y: first.y, size, text: text.trim() };
  });
}

function toBlocks(lines: Line[]): PdfTextBlock[] {
  const blocks: PdfTextBlock[] = [];
  let current: Line[] = [];
  const flush = () => {
    if (current.length === 0) return;
    const first = current[0]!;
    let text = '';
    for (const line of current) {
      if (text.endsWith('-') && /^[a-z]/.test(line.text)) text = text.slice(0, -1) + line.text;
      else text += (text ? ' ' : '') + line.text;
    }
    const left = Math.min(...current.map((line) => line.x));
    const right = Math.max(...current.map((line) => line.right));
    blocks.push({
      x: left,
      y: first.y - first.size,
      width: Math.max(right - left, first.size),
      fontSize: first.size,
      text,
      lineCount: current.length,
    });
    current = [];
  };
  for (const line of lines) {
    const prev = current[current.length - 1];
    const sameBlock =
      prev !== undefined &&
      line.y - prev.y > 0 &&
      line.y - prev.y < prev.size * 1.9 &&
      Math.abs(line.x - prev.x) < prev.size * 2 &&
      line.size / prev.size > 0.85 &&
      line.size / prev.size < 1.18;
    if (!sameBlock) flush();
    current.push(line);
  }
  flush();
  return blocks;
}

// ── Ink ─────────────────────────────────────────────────────────────────────

interface InkState {
  ctm: Matrix;
  lineWidth: number;
  color: string;
  alpha: number;
}

const CURVE_STEPS = 8;

/** Walk a pdf.js path buffer into sub-paths of user-space points. */
function subPaths(data: ArrayLike<number>): number[][] {
  const paths: number[][] = [];
  let cur: number[] = [];
  let lx = 0;
  let ly = 0;
  const flush = () => {
    if (cur.length >= 4) paths.push(cur);
    cur = [];
  };
  for (let i = 0; i < data.length; ) {
    const op = data[i++]!;
    if (op === 0) {
      flush();
      lx = data[i++]!;
      ly = data[i++]!;
      cur.push(lx, ly);
    } else if (op === 1) {
      lx = data[i++]!;
      ly = data[i++]!;
      cur.push(lx, ly);
    } else if (op === 2) {
      const [c1x, c1y, c2x, c2y, x, y] = [data[i]!, data[i + 1]!, data[i + 2]!, data[i + 3]!, data[i + 4]!, data[i + 5]!];
      i += 6;
      for (let s = 1; s <= CURVE_STEPS; s += 1) {
        const t = s / CURVE_STEPS;
        const u = 1 - t;
        cur.push(
          u * u * u * lx + 3 * u * u * t * c1x + 3 * u * t * t * c2x + t * t * t * x,
          u * u * u * ly + 3 * u * u * t * c1y + 3 * u * t * t * c2y + t * t * t * y,
        );
      }
      lx = x;
      ly = y;
    } else if (op === 3) {
      const [cx, cy, x, y] = [data[i]!, data[i + 1]!, data[i + 2]!, data[i + 3]!];
      i += 4;
      for (let s = 1; s <= CURVE_STEPS; s += 1) {
        const t = s / CURVE_STEPS;
        const u = 1 - t;
        cur.push(u * u * lx + 2 * u * t * cx + t * t * x, u * u * ly + 2 * u * t * cy + t * t * y);
      }
      lx = x;
      ly = y;
    } else if (op === 4) {
      if (cur.length >= 2) cur.push(cur[0]!, cur[1]!);
    } else {
      break; // unknown opcode: the buffer is no longer parseable
    }
  }
  flush();
  return paths;
}

/** Drop samples closer than `min` to the previous kept one. */
function thin(points: number[], min: number): number[] {
  const out: number[] = [points[0]!, points[1]!];
  for (let i = 2; i < points.length; i += 2) {
    const dx = points[i]! - out[out.length - 2]!;
    const dy = points[i + 1]! - out[out.length - 1]!;
    if (Math.hypot(dx, dy) >= min || i === points.length - 2) out.push(points[i]!, points[i + 1]!);
  }
  return out;
}

function parseAlpha(args: unknown, current: number): number {
  if (!Array.isArray(args)) return current;
  for (const entry of args) {
    if (Array.isArray(entry) && entry[0] === 'CA' && typeof entry[1] === 'number') return entry[1];
  }
  return current;
}

function extractInk(
  ops: { fnArray: number[]; argsArray: unknown[] },
  OPS: Record<string, number>,
  viewport: { transform: number[] },
  budget: number,
): { ink: PdfInkPath[]; truncated: boolean } {
  const strokeOps = new Set(
    ['stroke', 'closeStroke', 'fillStroke', 'eoFillStroke', 'closeFillStroke', 'closeEOFillStroke']
      .map((name) => OPS[name])
      .filter((op): op is number => op !== undefined),
  );
  let state: InkState = { ctm: IDENTITY, lineWidth: 1, color: '#000000', alpha: 1 };
  const stack: InkState[] = [];
  const ink: PdfInkPath[] = [];
  let truncated = false;
  let pending: number[][] = [];

  const emit = () => {
    const device = mul(viewport.transform, state.ctm);
    const scale = Math.sqrt(Math.abs(device[0] * device[3] - device[1] * device[2])) || 1;
    for (const path of pending) {
      if (ink.length >= budget) {
        truncated = true;
        break;
      }
      const mapped: number[] = [];
      for (let i = 0; i < path.length; i += 2) mapped.push(...apply(device, path[i]!, path[i + 1]!));
      const points = thin(mapped, 0.4);
      if (points.length < 4) continue;
      ink.push({
        points,
        width: Math.max(state.lineWidth * scale, 0.5),
        color: state.color,
        alpha: state.alpha,
      });
    }
    pending = [];
  };

  for (let i = 0; i < ops.fnArray.length; i += 1) {
    const fn = ops.fnArray[i]!;
    const args = ops.argsArray[i];
    if (fn === OPS.save) stack.push(state);
    else if (fn === OPS.restore) state = stack.pop() ?? state;
    else if (fn === OPS.transform && Array.isArray(args)) state = { ...state, ctm: mul(state.ctm, args as number[]) };
    else if (fn === OPS.paintFormXObjectBegin && Array.isArray(args)) {
      stack.push(state);
      if (Array.isArray(args[0])) state = { ...state, ctm: mul(state.ctm, args[0] as number[]) };
    } else if (fn === OPS.paintFormXObjectEnd) state = stack.pop() ?? state;
    else if (fn === OPS.setLineWidth && Array.isArray(args) && typeof args[0] === 'number') {
      state = { ...state, lineWidth: args[0] };
    } else if (fn === OPS.setStrokeRGBColor && Array.isArray(args) && typeof args[0] === 'string') {
      state = { ...state, color: args[0] };
    } else if (fn === OPS.setGState) state = { ...state, alpha: parseAlpha(args instanceof Array ? args[0] : null, state.alpha) };
    else if (fn === OPS.constructPath && Array.isArray(args)) {
      const [paintOp, buffers] = args as [number, unknown];
      const data = Array.isArray(buffers) ? (buffers[0] as ArrayLike<number> | null) : null;
      if (data && strokeOps.has(paintOp)) {
        pending = subPaths(data);
        emit();
      }
    } else if (strokeOps.has(fn) && pending.length > 0) emit();
  }
  return { ink, truncated };
}

// ── Entry point ────────────────────────────────────────────────────────────

export async function extractPdf(lib: PdfJsLike, data: Uint8Array): Promise<PdfExtraction> {
  const doc = await lib.getDocument({ data }).promise;
  const pages: PdfPageData[] = [];
  let truncated = doc.numPages > MAX_PDF_PAGES;
  let inkBudget = MAX_INK_PATHS;
  try {
    for (let n = 1; n <= Math.min(doc.numPages, MAX_PDF_PAGES); n += 1) {
      const page = await doc.getPage(n);
      const viewport = page.getViewport({ scale: 1 });
      const text = await page.getTextContent();
      const ops = await page.getOperatorList();
      const { ink, truncated: inkCut } = extractInk(ops, lib.OPS, viewport, inkBudget);
      inkBudget -= ink.length;
      truncated = truncated || inkCut;
      pages.push({
        width: viewport.width,
        height: viewport.height,
        blocks: toBlocks(toLines(toRawItems(text.items, viewport))),
        ink,
      });
    }
  } finally {
    await doc.destroy?.();
  }
  return { pages, truncated };
}
