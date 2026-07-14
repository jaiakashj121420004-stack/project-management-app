import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** Shown in the fallback, e.g. "the note editor". */
  label?: string;
}

interface State {
  error: Error | null;
}

/**
 * Catches render/runtime errors in a subtree and shows the message inline instead
 * of blanking the app. Used to wrap the block editor so a crash is visible (and
 * reportable) rather than a mysterious "nothing opens".
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
            onClick={() => this.setState({ error: null })}
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
