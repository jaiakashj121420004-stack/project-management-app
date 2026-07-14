/**
 * customTemplateStore.ts — a tiny module-level holder for the signed-in user's
 * custom note templates, read by the slash menu.
 *
 * The slash `items` callback runs *outside* React (inside a ProseMirror plugin),
 * so it can't call a hook to read the templates query. Mirroring the Phase-4
 * paletteStore / feedback-toast pattern, a React hook (`useSyncCustomTemplates`)
 * pushes the latest templates into this module snapshot, and `filterSlashItems`
 * reads it synchronously at query time. No subscription is needed — the menu
 * re-opens on each `/`, always reading the current snapshot.
 */
import type { JSONContent } from '@tiptap/core';

/** A custom template ready for the slash menu (blocks already extracted). */
export interface CustomTemplateItem {
  id: string;
  title: string;
  subtitle: string;
  /** Top-level blocks inserted at the caret. */
  blocks: JSONContent[];
}

let snapshot: CustomTemplateItem[] = [];

export function getCustomTemplates(): readonly CustomTemplateItem[] {
  return snapshot;
}

export function setCustomTemplates(next: CustomTemplateItem[]): void {
  snapshot = next;
}
