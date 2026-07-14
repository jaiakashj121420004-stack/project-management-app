/**
 * templateDoc.ts — pure conversions for custom note templates.
 *
 * A custom template stores a whole Tiptap document (`content_json`). The slash
 * menu inserts a template by dropping its *top-level blocks* at the caret, so we
 * peel the doc's `content` array out here. Kept pure + dependency-light so it's
 * trivially unit-testable and safe to import from the slash-menu code path.
 */
import type { JSONContent } from '@tiptap/core';

/**
 * The blocks a template inserts: the stored doc's top-level `content`. Defensive
 * — a missing/garbage doc yields an empty array (insert nothing) rather than
 * throwing into the editor.
 */
export function templateDocToBlocks(doc: unknown): JSONContent[] {
  if (!doc || typeof doc !== 'object') return [];
  const content = (doc as JSONContent).content;
  return Array.isArray(content) ? content : [];
}

/**
 * A one-line menu subtitle derived from the doc: the first non-empty line of
 * text, truncated. Falls back to a generic label for an empty/imageless doc.
 */
export function templateSubtitle(doc: unknown, max = 60): string {
  const blocks = templateDocToBlocks(doc);
  const firstText = firstLine(blocks);
  if (!firstText) return 'Custom template';
  return firstText.length > max ? `${firstText.slice(0, max - 1).trimEnd()}…` : firstText;
}

/** The first block that yields visible text, flattened. */
function firstLine(blocks: JSONContent[]): string {
  for (const block of blocks) {
    const text = flattenText(block).trim();
    if (text) return text;
  }
  return '';
}

function flattenText(node: JSONContent): string {
  if (node.type === 'text') return node.text ?? '';
  return (node.content ?? []).map(flattenText).join('');
}
