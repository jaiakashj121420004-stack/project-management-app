/**
 * docxExport.ts — convert a note's Tiptap JSON document into a real .docx file
 * and trigger a browser download. Used by NoteEditor.tsx's Pro-gated
 * "Export as Word" action (Task 36 of IMPROVEMENT-PLAN-2026-08.md).
 *
 * Library choice (researched 2026-08-22): `docx` (dolanmiu/docx on npm/GitHub)
 * — MIT, latest published version 9.7.1 (2026-05-27), actively maintained,
 * and explicitly supports running client-side in the browser via
 * `Packer.toBlob`. This has been the standard MIT-licensed choice for
 * generating real (not rasterized) .docx files in JS for years and still is.
 *
 * The whole `docx` package (~a real OOXML writer) is dynamically imported
 * inside `exportNoteAsDocx`, never imported at module scope, so it only ever
 * loads once a user actually clicks "Export as Word" — see vite.config.ts's
 * `manualChunks`, which explicitly excludes it from the eager `vendor` chunk
 * so this dynamic import gets its own async chunk (verified with
 * `npm run build` + `dist/stats.html`, see memory.md).
 *
 * v1 simplifications (documented deliberately, not silent gaps):
 *  - Math formulas (Task 33) have no LaTeX→OMML converter here. Word's native
 *    equation format (OMML) is a different, much larger format than LaTeX, so
 *    each formula is rasterized client-side (KaTeX → inline SVG → canvas →
 *    PNG) and embedded as an ordinary image — a faithful, readable rendering,
 *    but not a re-editable Word equation object.
 *  - Task lists render as a "☐ " / "☑ " glyph + text, not Word's native
 *    content-control checkbox — that control isn't reliably portable across
 *    Word/Google Docs/LibreOffice, so a plain glyph reads correctly
 *    everywhere instead of breaking on some importers.
 *  - Collapsible `details` blocks (no Word equivalent) flatten to a bold
 *    "summary" paragraph followed by its contents, always expanded.
 *  - Bullet glyphs (BULLET_LIST_STYLES) map to a real per-style bullet
 *    character via a custom numbering definition — Word and LibreOffice both
 *    render a custom `text` glyph on a bullet level natively, so this isn't a
 *    markdown-style fallback. Ordered-list styles (ORDERED_LIST_STYLES) use
 *    docx's native LevelFormat (decimal/upper-roman/etc.), also a real,
 *    native mapping, not an approximation.
 */
import type { JSONContent } from '@tiptap/core';
// Type-only import: erased at build time, so this does NOT pull `docx` into
// any eager chunk — only the runtime `dynamic import('docx')` inside
// exportNoteAsDocx below does that, and only on click (see module doc above).
import type { INumberingOptions } from 'docx';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { safeLinkHref, BULLET_LIST_STYLES, ORDERED_LIST_STYLES } from './extensions';
import { resolveNoteMediaUrl } from '@/features/notes/noteMedia';

type BulletStyle = (typeof BULLET_LIST_STYLES)[number];
type OrderedStyle = (typeof ORDERED_LIST_STYLES)[number];

const BULLET_GLYPH: Record<BulletStyle, string> = {
  disc: '●',
  circle: '○',
  square: '▪',
  hyphen: '-',
};

/** A resolved raster asset (image bytes + the natural pixel size to lay it out
 *  at) — shared shape for both real note images and rasterized math formulas. */
interface ResolvedAsset {
  data: Uint8Array;
  width: number;
  height: number;
}

const MAX_IMAGE_WIDTH_PX = 500;

/** Scale an intrinsic (width, height) down to fit MAX_IMAGE_WIDTH_PX, never up. */
function fitWidth(width: number, height: number): { width: number; height: number } {
  if (width <= MAX_IMAGE_WIDTH_PX || width <= 0) return { width: Math.max(1, width), height: Math.max(1, height) };
  const scale = MAX_IMAGE_WIDTH_PX / width;
  return { width: MAX_IMAGE_WIDTH_PX, height: Math.max(1, Math.round(height * scale)) };
}

/** Decode an image blob's natural pixel size in the browser. */
function naturalSize(blob: Blob): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth || 1, height: img.naturalHeight || 1 });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('image-decode-failed'));
    };
    img.src = url;
  });
}

/** Fetch a note-media image (by its private storage path) as raster bytes +
 *  its fitted display size. Returns null on any failure — a broken image
 *  reference is dropped from the export rather than aborting the whole thing. */
async function resolveNoteImage(path: string): Promise<ResolvedAsset | null> {
  try {
    // resolveNoteMediaUrl already swallows its own errors and returns null
    // (see noteMedia.ts) — one bad signed-URL fetch never aborts the export.
    const url = await resolveNoteMediaUrl(path);
    if (!url) return null;
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    const buffer = new Uint8Array(await blob.arrayBuffer());
    const { width, height } = await naturalSize(blob);
    return { data: buffer, ...fitWidth(width, height) };
  } catch {
    return null;
  }
}

/**
 * Rasterize a LaTeX formula to a PNG, via KaTeX's HTML output wrapped in an
 * inline SVG <foreignObject> and drawn to a <canvas> — no server round-trip,
 * no extra rasterization dependency. Rendered at 2x scale for crisper text at
 * normal on-page size. Returns null (never throws) for invalid LaTeX — the
 * caller falls back to the raw source as plain text, matching the live editor
 * and static-render behaviour in nodes/MathFormula.ts.
 */
async function rasterizeLatex(latex: string, displayMode: boolean): Promise<ResolvedAsset | null> {
  let container: HTMLDivElement | null = null;
  try {
    const html = katex.renderToString(latex, { throwOnError: true, displayMode, output: 'html' });
    container = document.createElement('div');
    container.style.cssText =
      'position:fixed;left:-99999px;top:0;visibility:hidden;font-size:18px;white-space:nowrap;';
    container.innerHTML = html;
    document.body.appendChild(container);

    const rect = container.getBoundingClientRect();
    const width = Math.max(1, Math.ceil(rect.width));
    const height = Math.max(1, Math.ceil(rect.height));
    const inner = new XMLSerializer().serializeToString(container);
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
      `<foreignObject width="100%" height="100%">` +
      inner.replace('<div', '<div xmlns="http://www.w3.org/1999/xhtml"') +
      `</foreignObject></svg>`;

    const image = new Image();
    const svgUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    const dataUrl = await new Promise<string>((resolve, reject) => {
      image.onload = () => {
        const scale = 2;
        const canvas = document.createElement('canvas');
        canvas.width = width * scale;
        canvas.height = height * scale;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('no-canvas-context'));
          return;
        }
        ctx.scale(scale, scale);
        ctx.drawImage(image, 0, 0, width, height);
        resolve(canvas.toDataURL('image/png'));
      };
      image.onerror = () => reject(new Error('svg-rasterize-failed'));
      image.src = svgUrl;
    });

    const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return { data: bytes, width, height };
  } catch {
    return null;
  } finally {
    if (container) container.remove();
  }
}

// ── Pass 1: collect every image path + math formula the doc references ─────

function collectAssets(node: JSONContent, images: Set<string>, formulas: Set<string>): void {
  const path = node.attrs?.path;
  if (node.type === 'noteImage' && typeof path === 'string' && path) {
    images.add(path);
  }
  const latex = node.attrs?.latex;
  if ((node.type === 'mathInline' || node.type === 'mathBlock') && typeof latex === 'string') {
    formulas.add(mathKey(node.type, latex));
  }
  for (const child of node.content ?? []) collectAssets(child, images, formulas);
}

function mathKey(type: string, latex: string): string {
  return `${type} ${latex}`;
}

interface AssetMaps {
  images: Map<string, ResolvedAsset>;
  formulas: Map<string, ResolvedAsset>;
}

async function resolveAssets(doc: JSONContent): Promise<AssetMaps> {
  const imagePaths = new Set<string>();
  const formulaKeys = new Set<string>();
  collectAssets(doc, imagePaths, formulaKeys);

  const images = new Map<string, ResolvedAsset>();
  await Promise.all(
    Array.from(imagePaths).map(async (path) => {
      const resolved = await resolveNoteImage(path);
      if (resolved) images.set(path, resolved);
    }),
  );

  const formulas = new Map<string, ResolvedAsset>();
  await Promise.all(
    Array.from(formulaKeys).map(async (key) => {
      const [type, latex] = key.split(' ');
      const resolved = await rasterizeLatex(latex ?? '', type === 'mathBlock');
      if (resolved) formulas.set(key, resolved);
    }),
  );

  return { images, formulas };
}

// ── Pass 2: JSON doc → docx document tree (sync, reads the resolved assets) ─

/** Lazily loaded once per export call — see the module doc comment for why
 *  this whole module never imports `docx` eagerly. */
type DocxModule = typeof import('docx');

function hexColor(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const hex = raw.trim().replace(/^#/, '');
  return /^[0-9a-fA-F]{6}$/.test(hex) ? hex.toUpperCase() : null;
}

function buildNumberingConfig(docx: DocxModule): INumberingOptions['config'] {
  const { LevelFormat, AlignmentType } = docx;
  const LEVEL_INDENT = 360; // twips per nesting level
  const config: INumberingOptions['config'][number][] = [];

  for (const style of BULLET_LIST_STYLES) {
    config.push({
      reference: bulletReference(style),
      levels: Array.from({ length: 4 }, (_, level) => ({
        level,
        format: LevelFormat.BULLET,
        text: BULLET_GLYPH[style],
        alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: LEVEL_INDENT * (level + 1), hanging: LEVEL_INDENT / 2 } } },
      })),
    });
  }

  const ORDERED_FORMAT: Record<OrderedStyle, (typeof LevelFormat)[keyof typeof LevelFormat]> = {
    decimal: LevelFormat.DECIMAL,
    'lower-alpha': LevelFormat.LOWER_LETTER,
    'upper-alpha': LevelFormat.UPPER_LETTER,
    'lower-roman': LevelFormat.LOWER_ROMAN,
    'upper-roman': LevelFormat.UPPER_ROMAN,
  };
  for (const style of ORDERED_LIST_STYLES) {
    config.push({
      reference: orderedReference(style),
      levels: Array.from({ length: 4 }, (_, level) => ({
        level,
        format: ORDERED_FORMAT[style],
        text: `%${level + 1}.`,
        alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: LEVEL_INDENT * (level + 1), hanging: LEVEL_INDENT / 2 } } },
      })),
    });
  }

  return config;
}

function bulletReference(style: BulletStyle): string {
  return `bullet-${style}`;
}
function orderedReference(style: OrderedStyle): string {
  return `ordered-${style}`;
}

/** Everything a single conversion pass needs: the docx module + the assets
 *  resolved in pass 1. Threaded through every helper instead of read from
 *  module state, so this file stays safe to call more than once concurrently. */
interface ConvertCtx {
  docx: DocxModule;
  assets: AssetMaps;
}

type ParagraphChild = InstanceType<DocxModule['TextRun']> | InstanceType<DocxModule['ExternalHyperlink']> | InstanceType<DocxModule['ImageRun']>;

function textRunOptionsFor(node: JSONContent, extra?: Record<string, unknown>): Record<string, unknown> {
  const opts: Record<string, unknown> = { text: node.text ?? '', ...extra };
  for (const mark of node.marks ?? []) {
    switch (mark.type) {
      case 'bold':
        opts.bold = true;
        break;
      case 'italic':
        opts.italics = true;
        break;
      case 'underline':
        opts.underline = {};
        break;
      case 'strike':
        opts.strike = true;
        break;
      case 'subscript':
        opts.subScript = true;
        break;
      case 'superscript':
        opts.superScript = true;
        break;
      case 'code':
        opts.font = 'Courier New';
        break;
      case 'highlight': {
        const fill = hexColor(mark.attrs?.color);
        if (fill) opts.shading = { fill };
        break;
      }
      case 'textStyle': {
        const color = hexColor(mark.attrs?.color);
        if (color) opts.color = color;
        break;
      }
      default:
        break;
    }
  }
  return opts;
}

/** One inline (text/hardBreak/mathInline) node → a paragraph child, or null to
 *  skip (an image whose fetch failed). Link marks wrap the run in an
 *  ExternalHyperlink; safeLinkHref is reused verbatim, never re-validated. */
function inlineNodeToChild(
  node: JSONContent,
  ctx: ConvertCtx,
  extraRunOpts?: Record<string, unknown>,
): ParagraphChild | null {
  const { TextRun, ExternalHyperlink, ImageRun } = ctx.docx;

  if (node.type === 'hardBreak') {
    return new TextRun({ text: '', break: 1, ...extraRunOpts });
  }

  if (node.type === 'mathInline') {
    const rawLatex = node.attrs?.latex;
    const latex = typeof rawLatex === 'string' ? rawLatex : '';
    const asset = ctx.assets.formulas.get(mathKey('mathInline', latex));
    if (!asset) return new TextRun({ text: latex ? `$${latex}$` : '', italics: true, ...extraRunOpts });
    return new ImageRun({ type: 'png', data: asset.data, transformation: { width: asset.width, height: asset.height } });
  }

  if (node.type !== 'text') return null;

  const linkMark = (node.marks ?? []).find((m) => m.type === 'link');
  const run = new TextRun(textRunOptionsFor(node, extraRunOpts));
  const href = linkMark ? safeLinkHref(String(linkMark.attrs?.href ?? '')) : null;
  return href ? new ExternalHyperlink({ link: href, children: [run] }) : run;
}

/** `extraRunOpts` layers extra TextRun formatting (e.g. forced italics for a
 *  blockquote, forced bold for a details summary) on top of each node's own
 *  marks, without hand-reconstructing an already-built run. */
function inlineChildren(
  nodes: JSONContent[] | undefined,
  ctx: ConvertCtx,
  extraRunOpts?: Record<string, unknown>,
): ParagraphChild[] {
  if (!nodes) return [];
  const children: ParagraphChild[] = [];
  for (const node of nodes) {
    const child = inlineNodeToChild(node, ctx, extraRunOpts);
    if (child) children.push(child);
  }
  return children.length > 0 ? children : [];
}

type Block = InstanceType<DocxModule['Paragraph']> | InstanceType<DocxModule['Table']>;

/** A list item's leading paragraph(s) + any nested lists, at the given depth
 *  (0-based, clamped to the 4 numbering levels defined in buildNumberingConfig). */
function listItemBlocks(
  item: JSONContent,
  depth: number,
  numbering: { reference: string; level: number } | null,
  taskPrefix: string | null,
  ctx: ConvertCtx,
): Block[] {
  const { Paragraph } = ctx.docx;
  const blocks: Block[] = [];
  const level = Math.min(depth, 3);

  const paragraphs = (item.content ?? []).filter((c) => c.type === 'paragraph');
  const nested = (item.content ?? []).filter(
    (c) => c.type === 'bulletList' || c.type === 'orderedList' || c.type === 'taskList',
  );

  paragraphs.forEach((para, i) => {
    const children = inlineChildren(para.content, ctx);
    if (i === 0 && taskPrefix) {
      children.unshift(new ctx.docx.TextRun({ text: taskPrefix }));
    }
    if (taskPrefix) {
      blocks.push(
        new Paragraph({
          children,
          indent: { left: 360 * (level + 1) },
        }),
      );
    } else {
      blocks.push(
        new Paragraph({
          children,
          numbering: i === 0 && numbering ? { reference: numbering.reference, level } : undefined,
        }),
      );
    }
  });

  for (const list of nested) {
    blocks.push(...listToBlocks(list, depth + 1, ctx));
  }

  return blocks;
}

function listToBlocks(list: JSONContent, depth: number, ctx: ConvertCtx): Block[] {
  const items = list.content ?? [];
  const level = Math.min(depth, 3);

  if (list.type === 'taskList') {
    return items.flatMap((item) => {
      const checked = item.attrs?.checked === true;
      return listItemBlocks(item, depth, null, checked ? '☑ ' : '☐ ', ctx);
    });
  }

  const rawListStyle = list.attrs?.listStyle;
  const style = typeof rawListStyle === 'string' ? rawListStyle : null;
  const reference =
    list.type === 'orderedList'
      ? orderedReference((ORDERED_LIST_STYLES as readonly string[]).includes(style ?? '') ? (style as OrderedStyle) : 'decimal')
      : bulletReference((BULLET_LIST_STYLES as readonly string[]).includes(style ?? '') ? (style as BulletStyle) : 'disc');

  return items.flatMap((item) => listItemBlocks(item, depth, { reference, level }, null, ctx));
}

/** A table cell's content → its own mini flow of blocks (usually one
 *  paragraph, but a cell can technically hold anything a document root can). */
function tableCellBlocks(cell: JSONContent, ctx: ConvertCtx): Block[] {
  const blocks = (cell.content ?? []).flatMap((child) => blockToDocx(child, ctx));
  // A cell needs at least one paragraph, or docx rejects it.
  return blocks.length > 0 ? blocks : [new ctx.docx.Paragraph({})];
}

function tableToDocx(table: JSONContent, ctx: ConvertCtx): InstanceType<DocxModule['Table']> {
  const { Table, TableRow, TableCell, WidthType, ShadingType } = ctx.docx;
  const rows = (table.content ?? []).filter((r) => r.type === 'tableRow');
  const docxRows = rows.map((row, rowIndex) => {
    const cells = (row.content ?? []).map((cell) => {
      const isHeader = cell.type === 'tableHeader' || rowIndex === 0;
      return new TableCell({
        width: { size: 100 / Math.max(1, (row.content ?? []).length), type: WidthType.PERCENTAGE },
        shading: isHeader ? { type: ShadingType.CLEAR, fill: 'F0EBE1' } : undefined,
        children: tableCellBlocks(cell, ctx),
      });
    });
    return new TableRow({ children: cells, tableHeader: rowIndex === 0 });
  });
  return new Table({ rows: docxRows, width: { size: 100, type: WidthType.PERCENTAGE } });
}

const HEADING_LEVEL: Record<number, keyof DocxModule['HeadingLevel']> = {
  1: 'HEADING_1',
  2: 'HEADING_2',
  3: 'HEADING_3',
};

/** One block node → zero or more docx blocks. Best-effort, mirroring
 *  serialize.ts's blockToMd: an unrecognised node degrades to its flattened
 *  inline text rather than being dropped silently. */
function blockToDocx(node: JSONContent, ctx: ConvertCtx): Block[] {
  const { Paragraph, TextRun } = ctx.docx;

  switch (node.type) {
    case 'paragraph':
      return [new Paragraph({ children: inlineChildren(node.content, ctx) })];

    case 'heading': {
      const level = Math.min(3, Math.max(1, Number(node.attrs?.level) || 1));
      return [
        new Paragraph({
          heading: ctx.docx.HeadingLevel[HEADING_LEVEL[level] ?? 'HEADING_1'],
          children: inlineChildren(node.content, ctx),
        }),
      ];
    }

    case 'blockquote':
      return (node.content ?? []).flatMap((child) => {
        if (child.type === 'paragraph') {
          return [
            new Paragraph({
              indent: { left: 360 },
              border: { left: { style: ctx.docx.BorderStyle.SINGLE, size: 12, color: '999999', space: 8 } },
              children: inlineChildren(child.content, ctx, { italics: true }),
            }),
          ];
        }
        return blockToDocx(child, ctx);
      });

    case 'codeBlock': {
      const text = (node.content ?? []).map((t) => t.text ?? '').join('');
      const lines = text.split('\n');
      const children = lines.flatMap((line, i) =>
        i === lines.length - 1
          ? [new TextRun({ text: line, font: 'Courier New' })]
          : [new TextRun({ text: line, font: 'Courier New', break: 1 })],
      );
      return [
        new Paragraph({
          children,
          shading: { type: ctx.docx.ShadingType.CLEAR, fill: 'F0EBE1' },
        }),
      ];
    }

    case 'horizontalRule':
      return [new Paragraph({ thematicBreak: true })];

    case 'bulletList':
    case 'orderedList':
    case 'taskList':
      return listToBlocks(node, 0, ctx);

    case 'details': {
      const summary = (node.content ?? []).find((c) => c.type === 'detailsSummary');
      const inner = (node.content ?? []).find((c) => c.type === 'detailsContent');
      const summaryChildren = inlineChildren(summary?.content, ctx, { bold: true });
      const blocks: Block[] = [
        new Paragraph({
          children: summaryChildren.length > 0 ? summaryChildren : [new TextRun({ text: 'Toggle', bold: true })],
        }),
      ];
      for (const child of inner?.content ?? []) blocks.push(...blockToDocx(child, ctx));
      return blocks;
    }

    case 'noteImage': {
      const rawPath = node.attrs?.path;
      const path = typeof rawPath === 'string' ? rawPath : null;
      const asset = path ? ctx.assets.images.get(path) : null;
      if (!asset) {
        return [new Paragraph({ children: [new TextRun({ text: `[image: ${String(node.attrs?.alt ?? 'attached')}]`, italics: true })] })];
      }
      return [
        new Paragraph({
          alignment: ctx.docx.AlignmentType.CENTER,
          children: [
            new ctx.docx.ImageRun({
              type: 'png',
              data: asset.data,
              transformation: { width: asset.width, height: asset.height },
            }),
          ],
        }),
      ];
    }

    case 'mathBlock': {
      const rawLatex = node.attrs?.latex;
      const latex = typeof rawLatex === 'string' ? rawLatex : '';
      const asset = ctx.assets.formulas.get(mathKey('mathBlock', latex));
      if (!asset) {
        return [new Paragraph({ alignment: ctx.docx.AlignmentType.CENTER, children: [new TextRun({ text: latex ? `$$${latex}$$` : '', italics: true })] })];
      }
      return [
        new Paragraph({
          alignment: ctx.docx.AlignmentType.CENTER,
          children: [
            new ctx.docx.ImageRun({
              type: 'png',
              data: asset.data,
              transformation: { width: asset.width, height: asset.height },
            }),
          ],
        }),
      ];
    }

    case 'noteEmbed': {
      const rawUrl = node.attrs?.embedUrl;
      const url = typeof rawUrl === 'string' ? rawUrl : '';
      const href = url ? safeLinkHref(url) : null;
      const rawProvider = node.attrs?.provider;
      const provider = typeof rawProvider === 'string' ? rawProvider : 'Embed';
      const label = new TextRun({ text: `${provider} embed`, italics: true });
      return [
        new Paragraph({
          children: href ? [new ctx.docx.ExternalHyperlink({ link: href, children: [label] })] : [label],
        }),
      ];
    }

    case 'canvasLink':
      return [
        new Paragraph({
          children: [new TextRun({ text: `[canvas: ${String(node.attrs?.title ?? 'Canvas')}]`, italics: true })],
        }),
      ];

    case 'table':
      return [tableToDocx(node, ctx)];

    default:
      return node.content ? [new Paragraph({ children: inlineChildren(node.content, ctx) })] : [];
  }
}

// ── Public entry point ───────────────────────────────────────────────────

/**
 * Convert a note's current Tiptap document to a .docx Blob and trigger its
 * download, named after the note's title — same sanitization + anchor-click
 * download pattern as NoteEditor.tsx's existing Markdown export. `(doc, title)`
 * parameter order matches the sibling exportNoteAsPdf (exportNotePdf.ts).
 */
export async function exportNoteAsDocx(doc: JSONContent | null, title: string): Promise<void> {
  const body = doc ?? { type: 'doc', content: [{ type: 'paragraph' }] };
  const docxModule = await import('docx');
  const assets = await resolveAssets(body);
  const ctx: ConvertCtx = { docx: docxModule, assets };

  const blocks: Block[] = (body.content ?? []).flatMap((node) => blockToDocx(node, ctx));

  const wordDoc = new docxModule.Document({
    numbering: { config: buildNumberingConfig(docxModule) },
    sections: [{ properties: {}, children: blocks.length > 0 ? blocks : [new docxModule.Paragraph({})] }],
  });

  const blob = await docxModule.Packer.toBlob(wordDoc);
  const cleanTitle = title.trim() || 'Untitled note';
  const filename = `${cleanTitle.replace(/[^\w\- ]+/g, '').trim() || 'note'}.docx`;

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
