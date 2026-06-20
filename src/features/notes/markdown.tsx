import { useMemo, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * A small, self-contained markdown renderer for the notes preview.
 *
 * Why no library: the brief asks to avoid a heavy dependency, the bundle is
 * already large, and rendering straight to React elements is XSS-safe by
 * construction — React escapes all text and we never use dangerouslySetInnerHTML.
 * Link URLs are additionally allow-listed (http/https/mailto/relative) so a
 * `javascript:` href can't slip through.
 *
 * Supported subset (the common note-taking shapes): headings, bold, italic,
 * inline code, fenced code blocks, links, blockquotes, ordered/unordered lists,
 * horizontal rules, and paragraphs with soft line breaks. Anything unrecognised
 * degrades gracefully to its literal text.
 */

const HEADING_CLASS: Record<number, string> = {
  1: 'font-display text-2xl font-bold text-fg mt-1',
  2: 'font-display text-xl font-bold text-fg mt-1',
  3: 'font-display text-lg font-semibold text-fg',
  4: 'text-base font-semibold text-fg',
  5: 'text-sm font-semibold text-fg-muted',
  6: 'text-xs font-semibold uppercase tracking-wide text-fg-subtle',
};

/** Allow only safe link targets; anything else renders as plain text. */
function safeUrl(raw: string): string | null {
  const url = raw.trim();
  if (/^(https?:\/\/|mailto:)/i.test(url)) return url;
  if (/^[/#]/.test(url)) return url;
  return null;
}

// code | **bold**/__bold__ | *italic*/_italic_ | [text](url)
const INLINE_RE = /`([^`]+)`|(\*\*|__)([\s\S]+?)\2|(\*|_)([\s\S]+?)\4|\[([^\]]+)\]\(([^)\s]+)\)/g;

/** Parse a single line of inline markdown into React nodes. */
function parseInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const re = new RegExp(INLINE_RE);
  let last = 0;
  let key = 0;
  let match: RegExpExecArray | null;

  while ((match = re.exec(text)) !== null) {
    if (match.index > last) nodes.push(text.slice(last, match.index));

    if (match[1] !== undefined) {
      nodes.push(
        <code
          key={key++}
          className="rounded bg-[var(--glass-fill)] px-1.5 py-0.5 font-mono text-[0.85em] text-fg"
        >
          {match[1]}
        </code>,
      );
    } else if (match[2] !== undefined) {
      nodes.push(
        <strong key={key++} className="font-semibold text-fg">
          {parseInline(match[3] ?? '')}
        </strong>,
      );
    } else if (match[4] !== undefined) {
      nodes.push(<em key={key++}>{parseInline(match[5] ?? '')}</em>);
    } else {
      const text6 = match[6] ?? '';
      const href = safeUrl(match[7] ?? '');
      nodes.push(
        href ? (
          <a
            key={key++}
            href={href}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="font-medium text-[var(--accent-from)] underline decoration-[var(--accent-from)]/40 underline-offset-2 hover:decoration-[var(--accent-from)]"
          >
            {parseInline(text6)}
          </a>
        ) : (
          <span key={key++}>{text6}</span>
        ),
      );
    }
    last = re.lastIndex;
  }

  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

/** Render lines joined by soft line breaks (used in paragraphs / quotes). */
function withBreaks(lines: string[]): ReactNode[] {
  return lines.flatMap((line, index) => {
    const parsed = parseInline(line);
    return index === 0 ? parsed : [<br key={`br-${index}`} />, ...parsed];
  });
}

/** Render a heading element for a given level (avoids a dynamic tag name). */
function heading(level: number, children: ReactNode, key: number): ReactNode {
  const className = HEADING_CLASS[level] ?? HEADING_CLASS[6];
  switch (level) {
    case 1:
      return <h1 key={key} className={className}>{children}</h1>;
    case 2:
      return <h2 key={key} className={className}>{children}</h2>;
    case 3:
      return <h3 key={key} className={className}>{children}</h3>;
    case 4:
      return <h4 key={key} className={className}>{children}</h4>;
    case 5:
      return <h5 key={key} className={className}>{children}</h5>;
    default:
      return <h6 key={key} className={className}>{children}</h6>;
  }
}

const HR_RE = /^\s*([-*_])(?:\s*\1){2,}\s*$/;
const HEADING_RE = /^(#{1,6})\s+(.*)$/;
const UL_RE = /^\s*[-*+]\s+(.*)$/;
const OL_RE = /^\s*\d+\.\s+(.*)$/;
const QUOTE_RE = /^\s*>\s?(.*)$/;

/** Parse block-level markdown into a list of React block elements. */
function renderBlocks(markdown: string): ReactNode[] {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const at = (index: number): string => lines[index] ?? '';
  const blocks: ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = at(i);

    // Blank line — skip.
    if (/^\s*$/.test(line)) {
      i++;
      continue;
    }

    // Fenced code block.
    if (/^\s*```/.test(line)) {
      const body: string[] = [];
      i++;
      while (i < lines.length && !/^\s*```/.test(at(i))) {
        body.push(at(i));
        i++;
      }
      i++; // consume closing fence (if present)
      blocks.push(
        <pre
          key={key++}
          className="overflow-x-auto rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-fill)] p-4 font-mono text-sm text-fg"
        >
          <code>{body.join('\n')}</code>
        </pre>,
      );
      continue;
    }

    // Horizontal rule.
    if (HR_RE.test(line)) {
      blocks.push(<hr key={key++} className="border-[var(--glass-border)]" />);
      i++;
      continue;
    }

    // Heading.
    const headingMatch = HEADING_RE.exec(line);
    if (headingMatch) {
      const level = (headingMatch[1] ?? '#').length;
      blocks.push(heading(level, parseInline(headingMatch[2] ?? ''), key++));
      i++;
      continue;
    }

    // Blockquote (consecutive `>` lines).
    if (QUOTE_RE.test(line)) {
      const quoted: string[] = [];
      while (i < lines.length && QUOTE_RE.test(at(i))) {
        quoted.push(QUOTE_RE.exec(at(i))?.[1] ?? '');
        i++;
      }
      blocks.push(
        <blockquote
          key={key++}
          className="border-l-2 border-[var(--accent-from)] pl-4 text-fg-muted"
        >
          {withBreaks(quoted)}
        </blockquote>,
      );
      continue;
    }

    // Unordered list.
    if (UL_RE.test(line)) {
      const items: string[] = [];
      while (i < lines.length && UL_RE.test(at(i))) {
        items.push(UL_RE.exec(at(i))?.[1] ?? '');
        i++;
      }
      blocks.push(
        <ul key={key++} className="ml-5 flex list-disc flex-col gap-1 text-fg marker:text-fg-subtle">
          {items.map((item, index) => (
            <li key={index}>{parseInline(item)}</li>
          ))}
        </ul>,
      );
      continue;
    }

    // Ordered list.
    if (OL_RE.test(line)) {
      const items: string[] = [];
      while (i < lines.length && OL_RE.test(at(i))) {
        items.push(OL_RE.exec(at(i))?.[1] ?? '');
        i++;
      }
      blocks.push(
        <ol
          key={key++}
          className="ml-5 flex list-decimal flex-col gap-1 text-fg marker:text-fg-subtle"
        >
          {items.map((item, index) => (
            <li key={index}>{parseInline(item)}</li>
          ))}
        </ol>,
      );
      continue;
    }

    // Paragraph — gather until a blank line or a block starter.
    const paragraph: string[] = [];
    while (i < lines.length) {
      const next = at(i);
      if (
        /^\s*$/.test(next) ||
        /^\s*```/.test(next) ||
        HEADING_RE.test(next) ||
        HR_RE.test(next) ||
        QUOTE_RE.test(next) ||
        UL_RE.test(next) ||
        OL_RE.test(next)
      ) {
        break;
      }
      paragraph.push(next);
      i++;
    }
    blocks.push(
      <p key={key++} className="leading-relaxed text-fg">
        {withBreaks(paragraph)}
      </p>,
    );
  }

  return blocks;
}

interface MarkdownProps {
  source: string;
  className?: string;
}

/** Render markdown text to a styled, safe React tree. */
export function Markdown({ source, className }: MarkdownProps) {
  const blocks = useMemo(() => renderBlocks(source), [source]);
  return <div className={cn('flex flex-col gap-3', className)}>{blocks}</div>;
}
