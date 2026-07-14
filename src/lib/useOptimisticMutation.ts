import {
  useMutation,
  useQueryClient,
  type QueryKey,
  type UseMutationResult,
} from '@tanstack/react-query';

/**
 * useOptimisticMutation — the one optimistic write primitive for the whole app.
 *
 * Every feature was hand-rolling the identical TanStack pattern:
 *   cancel in-flight fetches → snapshot the cache → patch it optimistically →
 *   roll back on error → reconcile the server row on success → invalidate on
 *   settle. `useBoardMutation`, `useNotesMutation`, `useFoldersMutation` and
 *   `useLibraryNotesMutation` were four near-verbatim copies. This hook is the
 *   single source of truth; those factories are now thin adapters over it.
 *
 * The cache entry for `queryKey` holds a `TSnapshot` — a board object, a `Note[]`,
 * a `Folder[]`, whatever the feature stores. `patch` receives the current
 * snapshot (possibly `undefined` before the first fetch) and returns the next
 * one; a feature that only patches an existing list returns `old` unchanged when
 * it's `undefined`. `reconcile` runs on success to fold the canonical server row
 * back in, and is only called when a snapshot is present.
 */
export interface OptimisticMutationConfig<TData, TVariables, TSnapshot> {
  /** The cache entry this mutation optimistically edits + invalidates. */
  queryKey: QueryKey;
  mutationFn: (variables: TVariables) => Promise<TData>;
  /** Current snapshot (maybe undefined) → next snapshot. */
  patch: (snapshot: TSnapshot | undefined, variables: TVariables) => TSnapshot | undefined;
  /** Fold the server result back into the snapshot on success (optional). */
  reconcile?: (snapshot: TSnapshot, data: TData, variables: TVariables) => TSnapshot;
  /** Extra work after settle — e.g. invalidating a sibling cache. */
  onSettledExtra?: () => void;
  /** Per-mutation error-toast metadata (see lib/queryClient.ts MutationCache). */
  meta?: { errorMessage?: string; suppressErrorToast?: boolean };
}

interface OptimisticContext<TSnapshot> {
  previous?: TSnapshot;
}

export function useOptimisticMutation<TData, TVariables, TSnapshot>(
  config: OptimisticMutationConfig<TData, TVariables, TSnapshot>,
): UseMutationResult<TData, Error, TVariables, OptimisticContext<TSnapshot>> {
  const queryClient = useQueryClient();
  const { queryKey, mutationFn, patch, reconcile, onSettledExtra, meta } = config;

  return useMutation<TData, Error, TVariables, OptimisticContext<TSnapshot>>({
    mutationFn,
    meta,
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<TSnapshot>(queryKey);
      queryClient.setQueryData<TSnapshot>(queryKey, (old) => patch(old, variables));
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous !== undefined) queryClient.setQueryData(queryKey, context.previous);
    },
    onSuccess: (data, variables) => {
      if (reconcile) {
        queryClient.setQueryData<TSnapshot>(queryKey, (old) =>
          old ? reconcile(old, data, variables) : old,
        );
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey });
      onSettledExtra?.();
    },
  });
}
