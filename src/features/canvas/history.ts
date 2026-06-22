/**
 * history.ts — local undo/redo for the canvas scene (P3.1).
 *
 * A minimal past/present/future command stack over whole-scene snapshots. The
 * surface (`scene`, `commit`, `undo`, `redo`, `canUndo`, `canRedo`, `reset`) is
 * deliberately small and storage-agnostic so P3.7 can swap this implementation
 * for a Yjs `Y.UndoManager` WITHOUT touching the editor — the editor only ever
 * talks to this interface, never to the underlying stacks.
 *
 * Each user gesture (add / delete / move-end / transform-end / lock-toggle)
 * calls `commit` exactly once, which pushes the prior scene onto the undo stack
 * and clears the redo stack — the standard editor semantics.
 */
import { useReducer, useCallback } from 'react';
import type { CanvasScene } from './elements';

/** Cap the undo depth so a long session can't grow memory without bound. */
const MAX_HISTORY = 100;

interface HistoryState {
  past: CanvasScene[];
  present: CanvasScene;
  future: CanvasScene[];
}

type HistoryAction =
  | { type: 'commit'; scene: CanvasScene }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'reset'; scene: CanvasScene };

function reducer(state: HistoryState, action: HistoryAction): HistoryState {
  switch (action.type) {
    case 'commit': {
      const past = [...state.past, state.present].slice(-MAX_HISTORY);
      return { past, present: action.scene, future: [] };
    }
    case 'undo': {
      const previous = state.past[state.past.length - 1];
      if (previous === undefined) return state;
      return {
        past: state.past.slice(0, -1),
        present: previous,
        future: [state.present, ...state.future],
      };
    }
    case 'redo': {
      const next = state.future[0];
      if (next === undefined) return state;
      return {
        past: [...state.past, state.present],
        present: next,
        future: state.future.slice(1),
      };
    }
    case 'reset':
      return { past: [], present: action.scene, future: [] };
    default:
      return state;
  }
}

/** The swappable history surface the editor consumes. */
export interface SceneHistory {
  scene: CanvasScene;
  /** Record a new scene as the present, pushing the prior one onto undo. */
  commit: (next: CanvasScene) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  /** Replace the present and clear both stacks (e.g. when switching canvases). */
  reset: (scene: CanvasScene) => void;
}

/** Local command-stack history over the canvas scene. */
export function useSceneHistory(initial: CanvasScene): SceneHistory {
  const [state, dispatch] = useReducer(reducer, {
    past: [],
    present: initial,
    future: [],
  });

  const commit = useCallback((next: CanvasScene) => dispatch({ type: 'commit', scene: next }), []);
  const undo = useCallback(() => dispatch({ type: 'undo' }), []);
  const redo = useCallback(() => dispatch({ type: 'redo' }), []);
  const reset = useCallback((scene: CanvasScene) => dispatch({ type: 'reset', scene }), []);

  return {
    scene: state.present,
    commit,
    undo,
    redo,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
    reset,
  };
}
