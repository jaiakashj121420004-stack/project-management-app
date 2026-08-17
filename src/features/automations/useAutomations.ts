import { useQuery, type QueryKey } from '@tanstack/react-query';
import { useOptimisticMutation } from '@/lib/useOptimisticMutation';
import { useAuth } from '@/hooks/useAuth';
import { track } from '@/lib/analytics';
import type { AutomationRule } from '@/types/database';
import {
  fetchAutomationRules,
  insertAutomationRule,
  removeAutomationRule,
  setAutomationRuleEnabled,
  toRuleConfigs,
  updateAutomationRule,
} from './api';
import type { AutomationRuleInput } from './schemas';

/**
 * A project's automation rules live in one cache entry, `['automation-rules',
 * projectId]` → AutomationRule[], oldest first — same one-snapshot-per-project
 * shape as the board/members/templates caches, wrapped over the shared
 * useOptimisticMutation primitive (lib/useOptimisticMutation.ts).
 */
const rulesKey = (projectId: string): QueryKey => ['automation-rules', projectId];

export function useAutomationRules(projectId: string | undefined) {
  return useQuery({
    queryKey: rulesKey(projectId ?? ''),
    enabled: Boolean(projectId),
    queryFn: () => fetchAutomationRules(projectId as string),
  });
}

export function useCreateAutomationRule(projectId: string) {
  const { user } = useAuth();
  return useOptimisticMutation<
    AutomationRule,
    AutomationRuleInput & { tempId: string },
    AutomationRule[]
  >({
    queryKey: rulesKey(projectId),
    mutationFn: (input) => insertAutomationRule(projectId, input),
    patch: (old, input) => {
      const { trigger_config, action_config } = toRuleConfigs(input);
      const optimistic: AutomationRule = {
        id: input.tempId,
        project_id: projectId,
        trigger_type: input.triggerType,
        trigger_config,
        action_type: input.actionType,
        action_config,
        enabled: true,
        created_by: user?.id ?? null,
        created_at: new Date().toISOString(),
      };
      return [...(old ?? []), optimistic];
    },
    reconcile: (old, created, { tempId }) => {
      // Fires only on a rule that actually persisted (mutation success), same
      // pattern as useBoard.ts's useAddCard -> first_card_created.
      track('automation_rule_created', {
        project_id: projectId,
        trigger_type: created.trigger_type,
      });
      return old.map((rule) => (rule.id === tempId ? created : rule));
    },
  });
}

export function useUpdateAutomationRule(projectId: string) {
  return useOptimisticMutation<
    AutomationRule,
    { id: string } & AutomationRuleInput,
    AutomationRule[]
  >({
    queryKey: rulesKey(projectId),
    mutationFn: ({ id, ...input }) => updateAutomationRule(id, input),
    patch: (old, { id, ...input }) => {
      const { trigger_config, action_config } = toRuleConfigs(input);
      return (old ?? []).map((rule) =>
        rule.id === id
          ? {
              ...rule,
              trigger_type: input.triggerType,
              trigger_config,
              action_type: input.actionType,
              action_config,
            }
          : rule,
      );
    },
    reconcile: (old, updated) => old.map((rule) => (rule.id === updated.id ? updated : rule)),
  });
}

export function useToggleAutomationRule(projectId: string) {
  return useOptimisticMutation<AutomationRule, { id: string; enabled: boolean }, AutomationRule[]>({
    queryKey: rulesKey(projectId),
    mutationFn: ({ id, enabled }) => setAutomationRuleEnabled(id, enabled),
    patch: (old, { id, enabled }) =>
      (old ?? []).map((rule) => (rule.id === id ? { ...rule, enabled } : rule)),
    reconcile: (old, updated) => old.map((rule) => (rule.id === updated.id ? updated : rule)),
  });
}

export function useDeleteAutomationRule(projectId: string) {
  return useOptimisticMutation<void, { id: string }, AutomationRule[]>({
    queryKey: rulesKey(projectId),
    mutationFn: ({ id }) => removeAutomationRule(id),
    patch: (old, { id }) => (old ?? []).filter((rule) => rule.id !== id),
  });
}
