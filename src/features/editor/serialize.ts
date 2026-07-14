/**
 * serialize.ts — conversions between the shared block schema and other formats.
 *
 *   emptyDoc()          a blank document (one empty paragraph)
 *   renderBlockHtml()   doc JSON → HTML string for static (non-editing) display
 *   docToPlainText()    doc JSON → plain text (previews, empty-check, search mirror)
 *   isEmptyDoc()        true when a doc has no visible text
 *   markdownToDoc()     legacy markdown → doc JSON (one-time note migration)
 *
 * The render + plain-text walkers are defensive: a malformed body never throws
 * past this boundary.
 */
import { generateHTML, type JSONContent } from '@tiptap/core';
import { blockExtensions } from './extensions';

export function emptyDoc(): JSONContent {
  return { type: 'doc', content: [{ type: 'paragraph' }] };
}

const htmlCache = new WeakMap<object, string>();

/** doc JSON → HTML for static display. '' for an empty/missing body so callers
 *  can show their own placeholder. Cached by body reference (bodies are replaced,
 *  never mutated, on edit) so re-rendering doesn't re-serialise every time. */
export function renderBlockHtml(body: Record<string, unknown> | null): string {
  if (!body) return '';
  const cached = htmlCache.get(body);
  if (cached !== undefined) return cached;
  try {
    const html = generateHTML(body, blockExtensions);
    htmlCache.set(body, html);
    return html;
  } catch {
    htmlCache.set(body, '');
    return '';
  }
}

/** Flatten a doc to plain text (newline between block nodes). Drives previews,
 *  the empty-state check, and the searchable `content` mirror. */
export function docToPlainText(body: Record<string, unknown> | null): string {
  if (!body) return '';
  const walk = (node: JSONContent): string => {
    if (node.type === 'text') return node.text ?? '';
    return (node.content ?? []).map(walk).join('');
  };
  const doc = body as JSONContent;
  return (doc.content ?? [])
    .map(walk)
    .join('\n')
    .trim();
}

export function isEmptyDoc(body: Record<string, unknown> | null): boolean {
  return docToPlainText(body).length === 0;
}

// ── doc → Markdown (note export) ─────────────────────────────────────────────

/** Serialise one text node with its marks applied (code/bold/italic/strike/link). */
function markText(node: JSONContent): string {
  let text = node.text ?? '';
  for (const mark of node.marks ?? []) {
    switch (mark.type) {
      case 'code':
        text = '`' + text + '`';
        break;
      case 'bold':
        text = '**' + text + '**';
        break;
      case 'italic':
        text = '*' + text + '*';
        break;
      case 'strike':
        text = '~~' + text + '~~';
        break;
      case 'link':
        text = '[' + text + '](' + String(mark.attrs?.href ?? '') + ')';
        break;
      default:
        break;
    }
  }
  return text;
}

/** Inline children → a markdown string (text + hard breaks). */
function inlineToMd(nodes: JSONContent[] | undefined): string {
  if (!nodes) return '';
  return nodes
    .map((node) => {
      if (node.type === 'text') return markText(node);
      if (node.type === 'hardBreak') return '  \n';
      return inlineToMd(node.content);
    })
    .join('');
}

/** The plain paragraphs of a list item, joined — nested lists handled separately. */
function itemLead(item: JSONContent): string {
  return (item.content ?? [])
    .filter((child) => child.type === 'paragraph')
    .map((child) => inlineToMd(child.content))
    .join(' ');
}

/** Nested lists inside a list item, indented under the parent marker. */
function nestedLists(item: JSONContent, indent: string): string {
  return (item.content ?? [])
    .filter((c) => c.type === 'bulletList' || c.type === 'orderedList' || c.type === 'taskList')
    .map((c) => '\n' + listToMd(c, indent + '  '))
    .join('');
}

function listToMd(list: JSONContent, indent: string): string {
  const items = list.content ?? [];
  return items
    .map((item, index) => {
      const lead =
        list.type === 'taskList'
          ? `- [${item.attrs?.checked === true ? 'x' : ' '}] ${itemLead(item)}`
          : list.type === 'orderedList'
            ? `${index + 1}. ${itemLead(item)}`
            : `- ${itemLead(item)}`;
      return indent + lead + nestedLists(item, indent);
    })
    .join('\n');
}

/** One block node → markdown, or null to skip. Best-effort; never throws. */
function blockToMd(node: JSONContent): string | null {
  switch (node.type) {
    case 'paragraph':
      return inlineToMd(node.content);
    case 'heading':
      return '#'.repeat(Math.min(3, Math.max(1, Number(node.attrs?.level) || 1))) + ' ' + inlineToMd(node.content);
    case 'blockquote':
      return (node.content ?? [])
        .map((child) => '> ' + (blockToMd(child) ?? ''))
        .join('\n');
    case 'codeBlock':
      return '```' + String(node.attrs?.language ?? '') + '\n' +
        (node.content ?? []).map((t) => t.text ?? '').join('') + '\n```';
    case 'horizontalRule':
      return '---';
    case 'bulletList':
    case 'orderedList':
    case 'taskList':
      return listToMd(node, '');
    case 'details': {
      const summary = (node.content ?? []).find((c) => c.type === 'detailsSummary');
      const inner = (node.content ?? []).find((c) => c.type === 'detailsContent');
      const body = (inner?.content ?? []).map((c) => blockToMd(c) ?? '').join('\n\n');
      return `**${inlineToMd(summary?.content) || 'Toggle'}**\n\n${body}`;
    }
    case 'noteImage':
      return `_[image: ${String(node.attrs?.alt ?? 'attached')}]_`;
    case 'noteEmbed': {
      const url = String(node.attrs?.embedUrl ?? '');
      return url ? `[${String(node.attrs?.provider ?? 'Embed')} embed](${url})` : '';
    }
    case 'canvasLink':
      return `_[canvas: ${String(node.attrs?.title ?? 'Canvas')}]_`;
    default:
      return node.content ? inlineToMd(node.content) : null;
  }
}

/** doc JSON → a Markdown string (note export). Private images and canvas links
 *  degrade to a bracketed placeholder — the private path is never leaked. */
export function docToMarkdown(body: Record<string, unknown> | null): string {
  if (!body) return '';
  const doc = body as JSONContent;
  const blocks = (doc.content ?? [])
    .map(blockToMd)
    .filter((s): s is string => s !== null);
  return (blocks.join('\n\n').replace(/\n{3,}/g, '\n\n').trim() + '\n');
}

// ── Legacy markdown → doc (one-time note migration) ──────────────────────────

/** Inline markdown → an array of Tiptap text nodes with marks. Handles code,
 *  bold, italic, strikethrough and links; anything else is literal text. */
function inlineToNodes(input: string): JSONContent[] {
  const nodes: JSONContent[] = [];
  // Ordered by precedence: code first (no nested marks), then link, then the
  // emphasis pairs. Each alternative captures its inner text in a group.
  const pattern =
    /(`([^`]+)`)|(\[([^\]]+)\]\(([^)\s]+)\))|(\*\*([^*]+)\*\*)|(__([^_]+)__)|(~~([^~]+)~~)|(\*([^*]+)\*)|(_([^_]+)_)/;

  let rest = input;
  while (rest.length > 0) {
    const match = pattern.exec(rest);
    if (!match || match.index === undefined) {
      nodes.push({ type: 'text', text: rest });
      break;
    }
    if (match.index > 0) {
      nodes.push({ type: 'text', text: rest.slice(0, match.index) });
    }
    if (match[2] !== undefined) {
      nodes.push({ type: 'text', text: match[2], marks: [{ type: 'code' }] });
    } else if (match[4] !== undefined && match[5] !== undefined) {
      const href = match[5];
      nodes.push({
        type: 'text',
        text: match[4],
        marks: [{ type: 'link', attrs: { href } }],
      });
    } else if (match[7] !== undefined) {
      nodes.push({ type: 'text', text: match[7], marks: [{ type: 'bold' }] });
    } else if (match[9] !== undefined) {
      nodes.push({ type: 'text', text: match[9], marks: [{ type: 'bold' }] });
    } else if (match[11] !== undefined) {
      nodes.push({ type: 'text', text: match[11], marks: [{ type: 'strike' }] });
    } else if (match[13] !== undefined) {
      nodes.push({ type: 'text', text: match[13], marks: [{ type: 'italic' }] });
    } else if (match[15] !== undefined) {
      nodes.push({ type: 'text', text: match[15], marks: [{ type: 'italic' }] });
    }
    rest = rest.slice(match.index + (match[0] ?? '').length);
  }
  return nodes.length > 0 ? nodes : [];
}

/** Wrap inline content as a paragraph (empty text array → an empty paragraph). */
function paragraph(text: string): JSONContent {
  const content = inlineToNodes(text);
  return content.length > 0 ? { type: 'paragraph', content } : { type: 'paragraph' };
}

const HEADING = /^(#{1,3})\s+(.*)$/;
const HR = /^\s*([-*_])\1{2,}\s*$/;
const BLOCKQUOTE = /^>\s?(.*)$/;
const TASK = /^[-*+]\s+\[([ xX])\]\s+(.*)$/;
const BULLET = /^[-*+]\s+(.*)$/;
const ORDERED = /^\d+[.)]\s+(.*)$/;

/**
 * Convert stored markdown (the pre-Phase-3 note format) into a block document.
 * Best-effort: covers headings, block quotes, task/bullet/ordered lists, fenced
 * code, horizontal rules and paragraphs, plus inline bold/italic/code/strike/
 * links. Unknown syntax degrades to literal text — never throws. An empty string
 * yields an empty document.
 */
export function markdownToDoc(markdown: string): JSONContent {
  const src = (markdown ?? '').replace(/\r\n/g, '\n');
  if (src.trim().length === 0) return emptyDoc();

  const lines = src.split('\n');
  // Indexed access is `string | undefined` under noUncheckedIndexedAccess; this
  // always returns a string so the block matchers below stay simple.
  const at = (n: number): string => lines[n] ?? '';
  const content: JSONContent[] = [];
  let i = 0;

  const listItem = (text: string): JSONContent => ({
    type: 'listItem',
    content: [paragraph(text)],
  });

  /** First capture group of a match, or '' — keeps callers undefined-free. */
  const cap = (re: RegExp, s: string, group = 1): string => re.exec(s)?.[group] ?? '';

  while (i < lines.length) {
    const line = at(i);

    if (line.trim() === '') {
      i += 1;
      continue;
    }

    // Fenced code block ``` … ```
    if (/^\s*```/.test(line)) {
      const body: string[] = [];
      i += 1;
      while (i < lines.length && !/^\s*```/.test(at(i))) {
        body.push(at(i));
        i += 1;
      }
      i += 1; // closing fence
      content.push({
        type: 'codeBlock',
        content: body.length ? [{ type: 'text', text: body.join('\n') }] : [],
      });
      continue;
    }

    if (HR.test(line)) {
      content.push({ type: 'horizontalRule' });
      i += 1;
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading) {
      content.push({
        type: 'heading',
        attrs: { level: (heading[1] ?? '#').length },
        content: inlineToNodes(heading[2] ?? ''),
      });
      i += 1;
      continue;
    }

    if (BLOCKQUOTE.test(line)) {
      const quote: string[] = [];
      while (i < lines.length && BLOCKQUOTE.test(at(i))) {
        quote.push(cap(BLOCKQUOTE, at(i)));
        i += 1;
      }
      content.push({ type: 'blockquote', content: [paragraph(quote.join(' '))] });
      continue;
    }

    // Task list (checked before the generic bullet, which would also match).
    if (TASK.test(line)) {
      const items: JSONContent[] = [];
      while (i < lines.length && TASK.test(at(i))) {
        const mark = cap(TASK, at(i), 1);
        items.push({
          type: 'taskItem',
          attrs: { checked: mark.toLowerCase() === 'x' },
          content: [paragraph(cap(TASK, at(i), 2))],
        });
        i += 1;
      }
      content.push({ type: 'taskList', content: items });
      continue;
    }

    if (BULLET.test(line)) {
      const items: JSONContent[] = [];
      while (i < lines.length && BULLET.test(at(i)) && !TASK.test(at(i))) {
        items.push(listItem(cap(BULLET, at(i))));
        i += 1;
      }
      content.push({ type: 'bulletList', content: items });
      continue;
    }

    if (ORDERED.test(line)) {
      const items: JSONContent[] = [];
      while (i < lines.length && ORDERED.test(at(i))) {
        items.push(listItem(cap(ORDERED, at(i))));
        i += 1;
      }
      content.push({ type: 'orderedList', content: items });
      continue;
    }

    // Paragraph: accumulate consecutive plain lines (soft-wrapped) into one.
    const para: string[] = [];
    while (
      i < lines.length &&
      at(i).trim() !== '' &&
      !HEADING.test(at(i)) &&
      !HR.test(at(i)) &&
      !BLOCKQUOTE.test(at(i)) &&
      !BULLET.test(at(i)) &&
      !ORDERED.test(at(i)) &&
      !/^\s*```/.test(at(i))
    ) {
      para.push(at(i).trim());
      i += 1;
    }
    content.push(paragraph(para.join(' ')));
  }

  return { type: 'doc', content: content.length ? content : [{ type: 'paragraph' }] };
}
