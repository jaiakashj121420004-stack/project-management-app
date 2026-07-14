import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** Shown in the fallback, e.g. "the note editor". */
  label?: string;
  /**
   * Called by "Try again" *before* the boundary clears its error. Used to pair
   * with React Query's `QueryErrorResetBoundary` so a retry also resets the
   * failed queries (see RouteErrorBoundary), not just the React error state.
   */
  onReset?: () => void;
  /**
   * When any value here changes while an error is showing, the boundary clears
   * itself automatically. Pass the route path so navigating away from a crashed
   * screen recovers without a manual retry.
   */
  resetKeys?: readonly unknown[];
}

interface State {
  error: Error | null;
}

/**
 * Catches render/runtime errors in a subtree and shows the message inline instead
 * of blanking the app. Wraps the authenticated shell's <Outlet/> and every lazy
 * <Suspense> (canvas/note editors, project page) so a crash or failed chunk-load
 * is visible and recoverable rather than a white screen.
 */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    // Surface it in the console for debugging too.
    console.error('ErrorBoundary caught:', error, info);
  }

  override componentDidUpdate(prev: Props) {
    // Auto-recover when the reset keys change (e.g. the user navigated away).
    if (this.state.error && !areKeysEqual(prev.resetKeys, this.props.resetKeys)) {
      this.reset();
    }
  }

  private reset = () => {
    this.props.onReset?.();
    this.setState({ error: null });
  };

  override render() {
    const { error } = this.state;
    if (error) {
      return (
        <div className="rounded-2xl border border-danger/30 bg-danger/10 p-5 text-sm">
          <p className="font-semibold text-danger">
            Couldn’t load {this.props.label ?? 'this'}.
          </p>
          <p className="mt-1 break-words text-fg-muted">{error.message}</p>
          <button
            type="button"
            onClick={this.reset}
            className="mt-3 rounded-lg bg-[var(--glass-fill)] px-3 py-1.5 text-xs font-medium text-fg hover:bg-[var(--glass-border)]"
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

/** Shallow equality for the resetKeys arrays (undefined-safe). */
function areKeysEqual(a: readonly unknown[] | undefined, b: readonly unknown[] | undefined): boolean {
  if (a === b) return true;
  if (!a || !b || a.length !== b.length) return false;
  return a.every((value, index) => Object.is(value, b[index]));
}
