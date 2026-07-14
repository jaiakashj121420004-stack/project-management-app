import { describe, it, expect } from 'vitest';
import * as Y from 'yjs';
import { applySceneDiff, buildDocFromScene, docToScene, getElementsArray } from './yCanvasDoc';
import type { CanvasScene, FrameElement } from '../elements';

// A minimal non-text element (frames carry no body/points, so they're the
// simplest valid CanvasElement to reconcile).
const frame = (id: string, z: number, label = id): FrameElement => ({
  id,
  type: 'frame',
  x: 0,
  y: 0,
  width: 100,
  height: 100,
  rotation: 0,
  z,
  locked: false,
  visible: true,
  label,
  color: '#7A2A26',
});

const scene = (...elements: FrameElement[]): CanvasScene => ({ elements });

describe('applySceneDiff + docToScene', () => {
  it('inserts new elements into an empty doc', () => {
    const doc = new Y.Doc();
    applySceneDiff(doc, scene(frame('a', 0), frame('b', 1)));
    expect(docToScene(doc).elements.map((e) => e.id)).toEqual(['a', 'b']);
  });

  it('always returns elements sorted by z regardless of array order', () => {
    const doc = new Y.Doc();
    applySceneDiff(doc, scene(frame('a', 3), frame('b', 1), frame('c', 2)));
    expect(docToScene(doc).elements.map((e) => e.id)).toEqual(['b', 'c', 'a']);
  });

  it('updates a changed field in place without adding a duplicate', () => {
    const doc = new Y.Doc();
    applySceneDiff(doc, scene(frame('a', 0, 'old')));
    applySceneDiff(doc, scene(frame('a', 0, 'new')));
    const els = docToScene(doc).elements;
    expect(els).toHaveLength(1);
    expect((els[0] as FrameElement).label).toBe('new');
    expect(getElementsArray(doc).length).toBe(1);
  });

  it('deletes elements that are absent from the next scene', () => {
    const doc = new Y.Doc();
    applySceneDiff(doc, scene(frame('a', 0), frame('b', 1)));
    applySceneDiff(doc, scene(frame('a', 0)));
    expect(docToScene(doc).elements.map((e) => e.id)).toEqual(['a']);
  });

  it('applies a mix of add, update and delete in one diff', () => {
    const doc = new Y.Doc();
    applySceneDiff(doc, scene(frame('a', 0), frame('b', 1)));
    applySceneDiff(doc, scene(frame('a', 0, 'kept'), frame('c', 2)));
    const els = docToScene(doc).elements;
    expect(els.map((e) => e.id)).toEqual(['a', 'c']);
    expect((els[0] as FrameElement).label).toBe('kept');
  });
});

describe('docToScene dedup', () => {
  it('collapses duplicate ids (keeping the first) so React keys stay unique', () => {
    const doc = new Y.Doc();
    // Two elements sharing an id can briefly exist if two clients seed the same
    // never-synced canvas at once; the snapshot must dedupe them.
    buildDocFromScene(doc, scene(frame('dup', 0), frame('dup', 1)), 'blank');
    expect(getElementsArray(doc).length).toBe(2);
    expect(docToScene(doc).elements.map((e) => e.id)).toEqual(['dup']);
  });

  it('returns an empty scene for an empty doc', () => {
    expect(docToScene(new Y.Doc()).elements).toEqual([]);
  });
});
