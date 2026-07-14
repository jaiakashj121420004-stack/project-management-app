import { describe, it, expect } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useOptimisticMutation } from './useOptimisticMutation';

/** A provider wrapper around a fresh, retry-free QueryClient. */
function wrapperFor(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

const KEY = ['optimistic-test'];

describe('useOptimisticMutation', () => {
  it('applies the optimistic patch, then reconciles the server result on success', async () => {
    const client = new QueryClient();
    client.setQueryData<number[]>(KEY, [1]);

    const { result } = renderHook(
      () =>
        useOptimisticMutation<number, number, number[]>({
          queryKey: KEY,
          mutationFn: async (v) => v * 10,
          patch: (old, v) => [...(old ?? []), v],
          // Replace the optimistic placeholder (2) with the canonical server value.
          reconcile: (old, data, v) => old.map((n) => (n === v ? data : n)),
        }),
      { wrapper: wrapperFor(client) },
    );

    act(() => {
      result.current.mutate(2);
    });

    // Optimistic write lands (onMutate awaits cancelQueries, so it's async).
    await waitFor(() => expect(client.getQueryData<number[]>(KEY)).toEqual([1, 2]));
    // On success the placeholder is reconciled to the server value.
    await waitFor(() => expect(client.getQueryData<number[]>(KEY)).toEqual([1, 20]));
  });

  it('rolls the snapshot back to the pre-mutation value on error', async () => {
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    client.setQueryData<number[]>(KEY, [1]);

    const { result } = renderHook(
      () =>
        useOptimisticMutation<number, number, number[]>({
          queryKey: KEY,
          mutationFn: async () => {
            throw new Error('boom');
          },
          patch: (old, v) => [...(old ?? []), v],
          meta: { suppressErrorToast: true },
        }),
      { wrapper: wrapperFor(client) },
    );

    act(() => {
      result.current.mutate(2);
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    // The failed write is undone — back to the original snapshot.
    expect(client.getQueryData<number[]>(KEY)).toEqual([1]);
  });
});
