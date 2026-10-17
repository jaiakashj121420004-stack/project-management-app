import { describe, expect, it } from 'vitest';
import { detectKind, fileToDoc, titleFromFile } from './textImport';

const file = (name: string, body: string, type = '') => new File([body], name, { type });

describe('text import', () => {
  it('detects kinds by extension and rejects the rest', () => {
    expect(detectKind(file('a.PDF', ''))).toBe('pdf');
    expect(detectKind(file('a.docx', ''))).toBe('docx');
    expect(detectKind(file('a.md', ''))).toBe('markdown');
    expect(detectKind(file('a.htm', ''))).toBe('html');
    expect(detectKind(file('a.txt', ''))).toBe('text');
    expect(detectKind(file('a.exe', ''))).toBeNull();
  });

  it('derives a title from the file name', () => {
    expect(titleFromFile(file('Lecture 3.final.pdf', ''))).toBe('Lecture 3.final');
  });

  it('imports markdown as headings and paragraphs', async () => {
    const doc = await fileToDoc(file('a.md', '# Title\n\nHello **world**'), 'markdown');
    expect(doc.content?.[0]?.type).toBe('heading');
    expect(doc.content?.[1]?.type).toBe('paragraph');
  });

  it('imports HTML, stripping scripts and images', async () => {
    const doc = await fileToDoc(
      file('a.html', '<h2>Hi</h2><p>Body</p><script>alert(1)</script><img src="x.png">'),
      'html',
    );
    const json = JSON.stringify(doc);
    expect(json).toContain('"heading"');
    expect(json).toContain('Body');
    expect(json).not.toContain('alert');
    expect(json).not.toContain('image');
  });

  it('imports plain text as paragraphs split on blank lines', async () => {
    const doc = await fileToDoc(file('a.txt', 'one\ntwo\n\nthree'), 'text');
    expect(doc.content).toHaveLength(2);
  });
});
