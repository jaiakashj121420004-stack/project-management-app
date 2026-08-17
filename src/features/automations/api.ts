import { supabase } from '@/lib/supabase';
import type { AutomationRule } from '@/types/database';
import type { AutomationRuleInput } from './schemas';

/**
 * Supabase data layer for automation rules (Pro/Team, Task 23). Every call is
 * governed by Row Level Security — RLS requires project membership to read,
 * and editor role + the project on Pro/Team to create/update (plan.md §6,
 * 20260817140000_automation_rules.sql); deletion only needs editor role.
 * useAutomations.ts wraps these with caching + optimistic updates.
 */

/** All automation rules for a project, oldest first (stable manual order —
 *  there's no drag-to-reorder for a list this small). */
export async function fetchAutomationRules(projectId: string): Promise<AutomationRule[]> {
  const { data, error } = await supabase
    .from('automation_rules')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data;
}

/** Turn the flat form shape into the two jsonb configs the table stores.
 *  Mirrors the DB's own shape constraints (automation_rules_trigger_config_shape
 *  / _action_config_shape) so a well-formed input here can never be rejected
 *  server-side for shape reasons. */
export function toRuleConfigs(input: AutomationRuleInput): {
  trigger_config: Record<string, unknown>;
  action_config: Record<string, unknown>;
} {
  const trigger_config =
    input.triggerType === 'card_moved_to_column' ? { column_id: input.triggerColumnId } : {};

  const action_config =
    input.actionType === 'move_to_column'
      ? { column_id: input.actionColumnId }
      : input.actionType === 'add_label'
        ? { label_id: input.actionLabelId }
        : { user_id: input.actionUserId ?? null };

  return { trigger_config, action_config };
}

/** The inverse of `toRuleConfigs` — pre-fills the edit form from a saved rule's
 *  jsonb configs. */
export function fromRule(rule: AutomationRule): AutomationRuleInput {
  return {
    triggerType: rule.trigger_type,
    triggerColumnId: (rule.trigger_config.column_id as string | undefined) ?? null,
    actionType: rule.action_type,
    actionColumnId: (rule.action_config.column_id as string | undefined) ?? null,
    actionLabelId: (rule.action_config.label_id as string | undefined) ?? null,
    actionUserId: (rule.action_config.user_id as string | null | undefined) ?? null,
  };
}

export async function insertAutomationRule(
  projectId: string,
  input: AutomationRuleInput,
): Promise<AutomationRule> {
  const { trigger_config, action_config } = toRuleConfigs(input);
  const { data, error } = await supabase
    .from('automation_rules')
    .insert({
      project_id: projectId,
      trigger_type: input.triggerType,
      trigger_config,
      action_type: input.actionType,
      action_config,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function updateAutomationRule(
  id: string,
  input: AutomationRuleInput,
): Promise<AutomationRule> {
  const { trigger_config, action_config } = toRuleConfigs(input);
  const { data, error } = await supabase
    .from('automation_rules')
    .update({
      trigger_type: input.triggerType,
      trigger_config,
      action_type: input.actionType,
      action_config,
    })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function setAutomationRuleEnabled(
  id: string,
  enabled: boolean,
): Promise<AutomationRule> {
  const { data, error } = await supabase
    .from('automation_rules')
    .update({ enabled })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function removeAutomationRule(id: string): Promise<void> {
  const { error } = await supabase.from('automation_rules').delete().eq('id', id);
  if (error) throw error;
}
