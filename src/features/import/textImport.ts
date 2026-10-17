/**
 * textImport.ts — MD / TXT / HTML / Word files → a note document.
 * Word goes through mammoth (docx → HTML); everything then lands in the same
 * sanitising HTML→Tiptap path so imported content is held to the same rules as
 * pasted content.
 */
import type { JSONContent } from '@tiptap/core';
import { htmlToDoc, markdownToDoc, emptyDoc } from '@/features/editor/serialize';

export type ImportKind = 'markdown' | 'text' | 'html' | 'docx' | 'pdf';

export const ACCEPT_ATTR = '.pdf,.docx,.md,.markdown,.txt,.html,.htm';
export const MAX_IMPORT_BYTES = 25 * 1024 * 1024;

export function detectKind(file: File): ImportKind | null {
  const name = file.name.toLowerCase();
  if (name.endsWith('.pdf') || file.type === 'application/pdf') return 'pdf';
  if (name.endsWith('.docx')) return 'docx';
  if (name.endsWith('.md') || name.endsWith('.markdown')) return 'markdown';
  if (name.endsWith('.html') || name.endsWith('.htm')) return 'html';
  if (name.endsWith('.txt') || file.type === 'text/plain') return 'text';
  return null;
}

export function titleFromFile(file: File): string {
  const base = file.name.replace(/\.[^.]+$/, '').trim();
  return (base || 'Imported file').slice(0, 120);
}

function textToDoc(text: string): JSONContent {
  const paragraphs = text
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map((chunk) => chunk.trim())
    .filter(Boolean);
  if (paragraphs.length === 0) return emptyDoc();
  return {
    type: 'doc',
    content: paragraphs.map((chunk) => ({
      type: 'paragraph',
      content: chunk
        .split('\n')
        .flatMap((line, i) => (i === 0 ? [{ type: 'text', text: line }] : [{ type: 'hardBreak' }, { type: 'text', text: line }])),
    })),
  };
}

/** Convert a non-PDF file to a note document. */
export async function fileToDoc(file: File, kind: Exclude<ImportKind, 'pdf'>): Promise<JSONContent> {
  if (kind === 'docx') {
    const mammoth = await import('mammoth');
    const { value } = await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() });
    return htmlToDoc(value);
  }
  const text = await file.text();
  if (kind === 'markdown') return markdownToDoc(text);
  if (kind === 'html') return htmlToDoc(text);
  return textToDoc(text);
}
