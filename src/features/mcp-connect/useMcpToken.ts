import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { fetchMcpTokenStatus, generateMcpToken, revokeMcpToken, rotateMcpToken } from './api';

const key = (userId: string | undefined) => ['mcp-token-status', userId] as const;

/** Whether the caller has an MCP token connected, and when it was
 *  created/last used. Never the plaintext — see api.ts. */
export function useMcpTokenStatus() {
  const { user } = useAuth();
  return useQuery({
    queryKey: key(user?.id),
    enabled: Boolean(user?.id),
    queryFn: fetchMcpTokenStatus,
    // Rarely changes; the mutations below invalidate it directly on success.
    staleTime: 60 * 1000,
  });
}

/** Generate or rotate both return the fresh PLAINTEXT token to the caller (for
 *  a one-time reveal panel — see McpConnectSection) rather than caching it;
 *  only the non-secret status is ever kept in the query cache. */
function useIssueMcpToken(mutationFn: () => Promise<string>) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: key(user?.id) });
    },
  });
}

export function useGenerateMcpToken() {
  return useIssueMcpToken(generateMcpToken);
}

export function useRotateMcpToken() {
  return useIssueMcpToken(rotateMcpToken);
}

export function useRevokeMcpToken() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: revokeMcpToken,
    onSuccess: () => {
      queryClient.setQueryData(key(user?.id), { exists: false, createdAt: null, lastUsedAt: null });
    },
  });
}
