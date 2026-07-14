import { describe, it, expect } from 'vitest';
import type { Folder } from '@/types/database';
import { buildFolderTree, descendantIds, folderPath } from './tree';

// The tree helpers read only `id` and `parent_id`; cast partial rows.
const folder = (id: string, parentId: string | null): Folder =>
  ({ id, parent_id: parentId }) as unknown as Folder;

// A small forest:
//   root1 → a → a1
//         → b
//   root2
const folders: Folder[] = [
  folder('root1', null),
  folder('a', 'root1'),
  folder('a1', 'a'),
  folder('b', 'root1'),
  folder('root2', null),
];

describe('buildFolderTree', () => {
  it('nests children under their parents and keeps roots at the top', () => {
    const roots = buildFolderTree(folders);
    expect(roots.map((r) => r.id)).toEqual(['root1', 'root2']);
    const root1 = roots[0]!;
    expect(root1.children.map((c) => c.id)).toEqual(['a', 'b']);
    expect(root1.children[0]!.children.map((c) => c.id)).toEqual(['a1']);
  });

  it('treats an orphan (missing parent) as a root, defensively', () => {
    const roots = buildFolderTree([folder('orphan', 'ghost')]);
    expect(roots.map((r) => r.id)).toEqual(['orphan']);
  });

  it('returns an empty forest for no folders', () => {
    expect(buildFolderTree([])).toEqual([]);
  });
});

describe('folderPath', () => {
  it('returns the ancestor trail oldest-first, including the target', () => {
    expect(folderPath(folders, 'a1').map((f) => f.id)).toEqual(['root1', 'a', 'a1']);
  });

  it('returns [] for the library root (null id)', () => {
    expect(folderPath(folders, null)).toEqual([]);
  });

  it('does not loop forever on a cyclic parent chain', () => {
    const cyclic = [folder('x', 'y'), folder('y', 'x')];
    const trail = folderPath(cyclic, 'x');
    // Terminates and only visits each node once.
    expect(trail.length).toBeLessThanOrEqual(2);
  });
});

describe('descendantIds', () => {
  it('includes the folder itself and its whole subtree', () => {
    expect(descendantIds(folders, 'root1')).toEqual(new Set(['root1', 'a', 'a1', 'b']));
  });

  it('returns just the folder for a leaf', () => {
    expect(descendantIds(folders, 'a1')).toEqual(new Set(['a1']));
  });

  it('never includes unrelated branches', () => {
    expect(descendantIds(folders, 'a').has('b')).toBe(false);
  });
});
