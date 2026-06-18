/**
 * Minimal typing for the View Transitions API (used for the theme cross-fade).
 * Not yet in every TS DOM lib; declared as optional so we feature-detect it.
 */
interface ViewTransition {
  finished: Promise<void>;
  ready: Promise<void>;
  updateCallbackDone: Promise<void>;
  skipTransition: () => void;
}

interface Document {
  startViewTransition?: (callback: () => void | Promise<void>) => ViewTransition;
}
