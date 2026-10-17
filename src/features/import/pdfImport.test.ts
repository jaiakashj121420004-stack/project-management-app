import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { extractPdf, type PdfJsLike } from './pdfExtract';
import { hasPdfContent, pdfToDoc, pdfToScene } from './pdfToContent';

async function load() {
  const lib = (await import('pdfjs-dist/legacy/build/pdf.mjs')) as unknown as PdfJsLike;
  const data = new Uint8Array(readFileSync(resolve(process.cwd(), 'src/features/import/__fixtures__/sample.pdf')));
  return extractPdf(lib, data);
}

describe('PDF import', () => {
  it('extracts text blocks and vector ink per page', async () => {
    const result = await load();
    expect(result.pages).toHaveLength(2);
    const [first, second] = result.pages;
    expect(first!.blocks.map((b) => b.text)).toEqual([
      'Chapter One',
      'Typed paragraph line one. Typed paragraph line two.',
    ]);
    expect(first!.ink).toHaveLength(1);
    expect(first!.ink[0]!.color).toBe('#1a33cc');
    expect(first!.ink[0]!.width).toBeCloseTo(2.5);
    // Page space is top-left origin: the stroke (y≈600 in PDF space) sits below the heading.
    const ys = first!.ink[0]!.points.filter((_, i) => i % 2 === 1);
    expect(Math.min(...ys)).toBeGreaterThan(200);
    expect(second!.blocks[0]!.text).toBe('Page two text');
    expect(hasPdfContent(result)).toEqual({ text: true, ink: true });
  });

  it('builds a note document with a heading and a page rule', async () => {
    const doc = pdfToDoc(await load());
    const types = (doc.content ?? []).map((n) => n.type);
    expect(types).toEqual(['heading', 'paragraph', 'horizontalRule', 'paragraph']);
  });

  it('builds a canvas scene: a frame per page, editable text, ink strokes', async () => {
    const scene = pdfToScene(await load());
    const count = (type: string) => scene.elements.filter((e) => e.type === type).length;
    expect(count('frame')).toBe(2);
    expect(count('stroke')).toBe(1);
    expect(count('text')).toBe(3);
    const stroke = scene.elements.find((e) => e.type === 'stroke');
    expect(stroke && stroke.type === 'stroke' && stroke.points.length % 3).toBe(0);
  });
});
