import { Fragment, type ReactNode } from 'react';
import { mentionRegex, type Mentionable } from './mentions';

/**
 * Render a comment body as plain text with `@Member` mentions highlighted. The
 * body is stored verbatim (no opaque tokens); we re-discover mentions against
 * the live roster, so a renamed member still highlights correctly. Newlines are
 * preserved; nothing is interpreted as HTML/markdown (XSS-safe by construction).
 */
export function MentionText({ body, members }: { body: string; members: Mentionable[] }) {
  const regex = mentionRegex(members);
  if (!regex) {
    return <span className="whitespace-pre-wrap break-words">{body}</span>;
  }

  const nodes: ReactNode[] = [];
  let last = 0;
  for (const match of body.matchAll(regex)) {
    const start = match.index ?? 0;
    if (start > last) nodes.push(body.slice(last, start));
    nodes.push(
      <span
        key={start}
        className="rounded bg-[var(--accent-from)]/15 px-1 font-medium text-[var(--accent-from)]"
      >
        {match[0]}
      </span>,
    );
    last = start + match[0].length;
  }
  if (last < body.length) nodes.push(body.slice(last));

  return (
    <span className="whitespace-pre-wrap break-words">
      {nodes.map((node, index) => (
        <Fragment key={index}>{node}</Fragment>
      ))}
    </span>
  );
}
