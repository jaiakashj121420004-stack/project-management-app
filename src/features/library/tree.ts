import type { Folder } from '@/types/database';

/** A folder plus its nested children — the shape the tree UI renders. */
export interface FolderNode extends Folder {
  children: FolderNode[];
}

/**
 * Assemble the flat folder list into a nested tree. Siblings keep the incoming
 * order (the API sorts by position then name). Any folder whose parent is missing
 * (shouldn't happen under RLS, but be defensive) is treated as a root.
 */
export function buildFolderTree(folders: Folder[]): FolderNode[] {
  const byId = new Map<string, FolderNode>();
  for (const folder of folders) byId.set(folder.id, { ...folder, children: [] });

  const roots: FolderNode[] = [];
  for (const folder of folders) {
    const node = byId.get(folder.id);
    if (!node) continue;
    const parent = folder.parent_id ? byId.get(folder.parent_id) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  return roots;
}

/**
 * The breadcrumb trail from the root down to (and including) `folderId`, oldest
 * ancestor first. Returns [] for the Library root (folderId null). Guarded
 * against cycles (the DB forbids them, but never loop forever on bad data).
 */
export function folderPath(folders: Folder[], folderId: string | null): Folder[] {
  if (!folderId) return [];
  const byId = new Map(folders.map((f) => [f.id, f]));
  const trail: Folder[] = [];
  const seen = new Set<string>();
  let current: string | null = folderId;
  while (current && !seen.has(current)) {
    seen.add(current);
    const folder: Folder | undefined = byId.get(current);
    if (!folder) break;
    trail.unshift(folder);
    current = folder.parent_id;
  }
  return trail;
}

/**
 * Every folder inside `folderId`'s subtree, INCLUDING itself — the set a folder
 * can't be moved into (that would orphan it). Used to disable invalid move
 * targets in the picker (the DB trigger is the real guard).
 */
export function descendantIds(folders: Folder[], folderId: string): Set<string> {
  const childrenOf = new Map<string, string[]>();
  for (const folder of folders) {
    if (!folder.parent_id) continue;
    const list = childrenOf.get(folder.parent_id) ?? [];
    list.push(folder.id);
    childrenOf.set(folder.parent_id, list);
  }
  const result = new Set<string>([folderId]);
  const stack = [folderId];
  while (stack.length) {
    const id = stack.pop() as string;
    for (const child of childrenOf.get(id) ?? []) {
      if (!result.has(child)) {
        result.add(child);
        stack.push(child);
      }
    }
  }
  return result;
}
