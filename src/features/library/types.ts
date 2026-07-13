/** A row in the Library contents view — a subfolder, a standalone note, or a
 *  personal canvas. Kept intentionally small; the components resolve icons +
 *  actions from `kind`. */
export type LibraryItem =
  | { kind: 'folder'; id: string; name: string }
  | { kind: 'note'; id: string; title: string; subtitle: string }
  | { kind: 'canvas'; id: string; title: string; subtitle: string };

export function itemLabel(item: LibraryItem): string {
  return item.kind === 'folder' ? item.name : item.title;
}
