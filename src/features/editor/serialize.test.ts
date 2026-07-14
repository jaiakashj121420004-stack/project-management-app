import { describe, it, expect } from 'vitest';
import {
  docToMarkdown,
  docToPlainText,
  emptyDoc,
  isEmptyDoc,
  markdownToDoc,
  renderBlockHtml,
  sanitizeBlockHtml,
} from './serialize';

describe('emptyDoc / isEmptyDoc', () => {
  it('emptyDoc is a doc with a single empty paragraph', () => {
    expect(emptyDoc()).toEqual({ type: 'doc', content: [{ type: 'paragraph' }] });
  });

  it('isEmptyDoc is true for an empty doc and for null', () => {
    expect(isEmptyDoc(emptyDoc())).toBe(true);
    expect(isEmptyDoc(null)).toBe(true);
  });

  it('isEmptyDoc is false once there is visible text', () => {
    expect(isEmptyDoc(markdownToDoc('hello'))).toBe(false);
  });
});

describe('docToPlainText', () => {
  it('joins block text with newlines and trims', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'one' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'two' }] },
      ],
    };
    expect(docToPlainText(doc)).toBe('one\ntwo');
  });

  it('returns an empty string for a null body', () => {
    expect(docToPlainText(null)).toBe('');
  });
});

describe('renderBlockHtml', () => {
  it('returns an empty string for a null body', () => {
    expect(renderBlockHtml(null)).toBe('');
  });

  it('escapes HTML in text content (no raw injection)', () => {
    const doc = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: '<script>alert(1)</script>' }] }],
    };
    const html = renderBlockHtml(doc);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('never throws on a malformed body (returns a string)', () => {
    expect(typeof renderBlockHtml({ not: 'a real doc' })).toBe('string');
  });
});

describe('sanitizeBlockHtml (XSS defense-in-depth)', () => {
  it('strips <script> tags', () => {
    const out = sanitizeBlockHtml('<p>hi</p><script>alert(1)</script>');
    expect(out).toContain('hi');
    expect(out.toLowerCase()).not.toContain('<script');
  });

  it('strips inline event handlers', () => {
    const out = sanitizeBlockHtml('<p onclick="steal()">click</p>');
    expect(out).not.toContain('onclick');
    expect(out).toContain('click');
  });

  it('drops javascript: image sources and onerror payloads', () => {
    const out = sanitizeBlockHtml('<img src="x" onerror="alert(1)">');
    expect(out).not.toContain('onerror');
  });

  it('removes <iframe> and other active embeds', () => {
    const out = sanitizeBlockHtml('<iframe src="https://evil.test"></iframe><p>ok</p>');
    expect(out.toLowerCase()).not.toContain('<iframe');
    expect(out).toContain('ok');
  });

  it('preserves safe formatting, links (with target) and task checkboxes', () => {
    const html =
      '<a href="https://aurora.test" target="_blank" rel="noopener noreferrer nofollow">link</a>' +
      '<ul data-type="taskList"><li data-checked="true"><label><input type="checkbox" checked><span></span></label><div><p>task</p></div></li></ul>';
    const out = sanitizeBlockHtml(html);
    expect(out).toContain('href="https://aurora.test"');
    expect(out).toContain('target="_blank"');
    expect(out).toContain('type="checkbox"');
    expect(out).toContain('task');
  });

  it('is applied by renderBlockHtml (no script survives a tampered body)', () => {
    // A hand-crafted body that smuggles raw HTML into a text node. The hardened
    // schema escapes it, and the DOMPurify pass is the second guarantee.
    const doc = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: '<img src=x onerror=alert(1)>' }] }],
    };
    const out = renderBlockHtml(doc);
    expect(out).not.toContain('onerror');
  });
});

describe('markdownToDoc', () => {
  it('yields an empty doc for empty input', () => {
    expect(markdownToDoc('')).toEqual(emptyDoc());
    expect(markdownToDoc('   ')).toEqual(emptyDoc());
  });

  it('parses a heading with its level', () => {
    const doc = markdownToDoc('## Title');
    const first = doc.content?.[0];
    expect(first?.type).toBe('heading');
    expect(first?.attrs?.level).toBe(2);
  });

  it('parses a task list with checked state', () => {
    const doc = markdownToDoc('- [x] done\n- [ ] todo');
    const list = doc.content?.[0];
    expect(list?.type).toBe('taskList');
    expect(list?.content?.[0]?.attrs?.checked).toBe(true);
    expect(list?.content?.[1]?.attrs?.checked).toBe(false);
  });

  it('parses inline bold marks', () => {
    const doc = markdownToDoc('a **bold** word');
    const marks = doc.content?.[0]?.content?.find((n) => n.text === 'bold')?.marks;
    expect(marks?.[0]?.type).toBe('bold');
  });
});

describe('docToMarkdown', () => {
  it('renders headings, bullets and inline marks', () => {
    const md = docToMarkdown(markdownToDoc('# Heading\n\n- item one\n- item two'));
    expect(md).toContain('# Heading');
    expect(md).toContain('- item one');
    expect(md).toContain('- item two');
  });

  it('returns an empty string for a null body', () => {
    expect(docToMarkdown(null)).toBe('');
  });

  it('round-trips a bold mark through markdown → doc → markdown', () => {
    const md = docToMarkdown(markdownToDoc('some **strong** text'));
    expect(md).toContain('**strong**');
  });
});
