/**
 * pdfToContent.ts — turn extracted PDF geometry into Jotspring content: a note
 * document (headings + paragraphs) or a canvas scene (a frame per page with
 * editable text boxes and handwriting strokes laid out where they were).
 */
import type { JSONContent } from '@tiptap/core';
import {
  createTextBoxAt,
  type CanvasElement,
  type CanvasScene,
  type FrameElement,
  type StrokeElement,
  type TextBoxElement,
} from '@/features/canvas/elements';
import { emptyDoc } from '@/features/editor/serialize';
import type { PdfExtraction, PdfInkPath, PdfTextBlock } from './pdfExtract';

const PAGE_GAP = 80;
/** Rough rendered text metrics of a canvas text box, used to size boxes. */
const CANVAS_CHAR_WIDTH = 8.5;
const CANVAS_LINE_HEIGHT = 26;

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)]!;
}

/** The body font size: the median over blocks, weighted by text length. */
function bodySize(blocks: PdfTextBlock[]): number {
  const sizes: number[] = [];
  for (const block of blocks) {
    const weight = Math.max(1, Math.round(block.text.length / 20));
    for (let i = 0; i < weight; i += 1) sizes.push(block.fontSize);
  }
  return median(sizes);
}

function headingLevel(block: PdfTextBlock, body: number): 1 | 2 | 3 | null {
  if (body <= 0 || block.lineCount > 3 || block.text.length > 140) return null;
  const ratio = block.fontSize / body;
  if (ratio >= 1.7) return 1;
  if (ratio >= 1.4) return 2;
  if (ratio >= 1.2) return 3;
  return null;
}

function blockNode(block: PdfTextBlock, body: number): JSONContent {
  const text = [{ type: 'text', text: block.text }];
  const level = headingLevel(block, body);
  return level
    ? { type: 'heading', attrs: { level }, content: text }
    : { type: 'paragraph', content: text };
}

export function hasPdfContent(extraction: PdfExtraction): { text: boolean; ink: boolean } {
  return {
    text: extraction.pages.some((page) => page.blocks.length > 0),
    ink: extraction.pages.some((page) => page.ink.length > 0),
  };
}

/** All page text as one note document; pages are separated by a rule. */
export function pdfToDoc(extraction: PdfExtraction): JSONContent {
  const body = bodySize(extraction.pages.flatMap((page) => page.blocks));
  const content: JSONContent[] = [];
  for (const page of extraction.pages) {
    if (page.blocks.length === 0) continue;
    if (content.length > 0) content.push({ type: 'horizontalRule' });
    for (const block of page.blocks) content.push(blockNode(block, body));
  }
  return content.length > 0 ? { type: 'doc', content } : emptyDoc();
}

function textBox(block: PdfTextBlock, body: number, ox: number, oy: number, z: number): TextBoxElement {
  const width = Math.min(Math.max(block.width * 1.4, 140), 700);
  const charsPerLine = Math.max(Math.floor(width / CANVAS_CHAR_WIDTH), 8);
  const lines = Math.max(1, Math.ceil(block.text.length / charsPerLine));
  return {
    ...createTextBoxAt(ox + block.x, oy + block.y, z, {
      width,
      height: lines * CANVAS_LINE_HEIGHT + 16,
    }),
    body: { type: 'doc', content: [blockNode(block, body)] },
    text: block.text,
  };
}

function strokeElement(path: PdfInkPath, ox: number, oy: number, z: number): StrokeElement {
  let minX = Infinity;
  let minY = Infinity;
  for (let i = 0; i < path.points.length; i += 2) {
    minX = Math.min(minX, path.points[i]!);
    minY = Math.min(minY, path.points[i + 1]!);
  }
  const points: number[] = [];
  let maxX = 0;
  let maxY = 0;
  for (let i = 0; i < path.points.length; i += 2) {
    const x = path.points[i]! - minX;
    const y = path.points[i + 1]! - minY;
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
    points.push(x, y, 0.5);
  }
  const highlighter = path.alpha < 0.8;
  return {
    id: crypto.randomUUID(),
    type: 'stroke',
    x: ox + minX,
    y: oy + minY,
    width: maxX,
    height: maxY,
    rotation: 0,
    z,
    locked: false,
    visible: true,
    points,
    color: path.color,
    size: path.width,
    thinning: 0,
    smoothing: 0.5,
    opacity: path.alpha,
    blend: highlighter ? 'multiply' : 'normal',
    simulatePressure: false,
  };
}

function pageFrame(label: string, width: number, height: number, ox: number, oy: number, z: number): FrameElement {
  return {
    id: crypto.randomUUID(),
    type: 'frame',
    x: ox,
    y: oy,
    width,
    height,
    rotation: 0,
    z,
    locked: false,
    visible: true,
    label,
    color: '#7A2A26',
  };
}

/** Pages stacked top to bottom, each a frame holding its text boxes + strokes. */
export function pdfToScene(extraction: PdfExtraction): CanvasScene {
  const body = bodySize(extraction.pages.flatMap((page) => page.blocks));
  const elements: CanvasElement[] = [];
  let z = 0;
  let oy = 0;
  extraction.pages.forEach((page, index) => {
    elements.push(pageFrame(`Page ${index + 1}`, page.width, page.height, 0, oy, z++));
    for (const path of page.ink) elements.push(strokeElement(path, 0, oy, z++));
    for (const block of page.blocks) elements.push(textBox(block, body, 0, oy, z++));
    oy += page.height + PAGE_GAP;
  });
  return { elements };
}
