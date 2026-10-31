/**
 * importFile.ts — orchestrates an import: read the file, convert it, create the
 * note or canvas in the Library, and write the converted content into it.
 * Heavy parsers (pdf.js, mammoth) are loaded on demand so they never touch the
 * initial bundle.
 */
import type { JSONContent } from '@tiptap/core';
import { insertIndependentCanvas, patchCanvas } from '@/features/canvas/api';
import { createPageTextAt, type CanvasScene, type TextBoxElement } from '@/features/canvas/elements';
import { insertStandaloneNote, patchNote } from '@/features/notes/api';
import { docToPlainText } from '@/features/editor/serialize';
import { extractPdf, type PdfExtraction } from './pdfExtract';
import { hasPdfContent, pdfToDoc, pdfToScene } from './pdfToContent';
import { fileToDoc, titleFromFile, type ImportKind } from './textImport';

export type ImportTarget = 'note' | 'canvas';

export interface ImportResult {
  kind: ImportTarget;
  id: string;
  /** Shown after import when something was skipped or capped. */
  notice: string | null;
}

export class ImportError extends Error {}

async function readPdf(file: File): Promise<PdfExtraction> {
  const [lib, worker] = await Promise.all([
    import('pdfjs-dist/legacy/build/pdf.mjs'),
    import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'),
  ]);
  lib.GlobalWorkerOptions.workerSrc = worker.default;
  try {
    return await extractPdf(lib, new Uint8Array(await file.arrayBuffer()));
  } catch {
    throw new ImportError("That PDF couldn't be read. It may be damaged or password-protected.");
  }
}

function docToScene(doc: JSONContent): CanvasScene {
  const text = docToPlainText(doc);
  const lines = text.split('\n').reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / 80)), 0);
  const box: TextBoxElement = {
    ...createPageTextAt(0, 0, 0),
    body: doc,
    text,
  };
  box.height = Math.max(56, lines * 28 + 24);
  return { elements: [box] };
}

export async function importFile(
  file: File,
  kind: ImportKind,
  target: ImportTarget,
  folderId: string | null,
): Promise<ImportResult> {
  const title = titleFromFile(file);
  let doc: JSONContent | null = null;
  let scene: CanvasScene | null = null;
  let notice: string | null = null;

  if (kind === 'pdf') {
    const extraction = await readPdf(file);
    const found = hasPdfContent(extraction);
    if (!found.text && !found.ink) {
      throw new ImportError(
        "This PDF has no selectable text or vector handwriting — it's probably a scan or a flattened image, which Jotspring can't convert yet.",
      );
    }
    if (target === 'note') {
      if (!found.text) {
        throw new ImportError('This PDF only contains handwriting. Import it into a canvas instead.');
      }
      doc = pdfToDoc(extraction);
      if (found.ink) notice = 'Handwriting in the PDF was left out — import it into a canvas to keep it.';
    } else {
      scene = pdfToScene(extraction);
    }
    if (extraction.truncated) {
      notice = 'Large PDF: only the first pages and strokes were imported.';
    }
  } else {
    doc = await fileToDoc(file, kind);
    if (target === 'canvas') scene = docToScene(doc);
  }

  if (target === 'canvas' && scene) {
    const row = await insertIndependentCanvas({ title, folderId });
    await patchCanvas(row.id, { scene });
    return { kind: 'canvas', id: row.id, notice };
  }
  const row = await insertStandaloneNote({ title, folderId });
  const body = doc ?? { type: 'doc', content: [{ type: 'paragraph' }] };
  await patchNote(row.id, {
    content_json: body,
    content: docToPlainText(body),
  });
  return { kind: 'note', id: row.id, notice };
}
