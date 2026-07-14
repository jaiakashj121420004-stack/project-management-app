import type { ReactNode } from 'react';
import { QueryErrorResetBoundary } from '@tanstack/react-query';
import { ErrorBoundary } from './ErrorBoundary';

/**
 * The app's standard crash boundary: the inline `ErrorBoundary` fallback wired to
 * React Query's `QueryErrorResetBoundary`, so "Try again" both clears the React
 * error state AND resets any errored queries in the subtree (they refetch on the
 * next render). Wrap the root <Outlet/> and each lazy <Suspense> with this.
 */
export function RouteErrorBoundary({
  label,
  resetKeys,
  children,
}: {
  label?: string;
  resetKeys?: readonly unknown[];
  children: ReactNode;
}) {
  return (
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <ErrorBoundary label={label} onReset={reset} resetKeys={resetKeys}>
          {children}
        </ErrorBoundary>
      )}
    </QueryErrorResetBoundary>
  );
}
