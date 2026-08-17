import type { AutomationRule } from '@/types/database';

/**
 * Renders one automation rule as a single readable sentence — the UI NEVER
 * shows raw trigger_type/action_type/config JSON (task brief, item 4). Takes
 * plain lookup maps (column/label/member id -> display name) built from data
 * the Automations dialog already has loaded (board columns, labels, members),
 * rather than fetching anything of its own.
 */
export interface RuleLookups {
  columnNames: Map<string, string>;
  labelNames: Map<string, string>;
  memberNames: Map<string, string>;
}

const FALLBACK = 'a deleted item';

function describeTrigger(rule: AutomationRule, lookups: RuleLookups): string {
  switch (rule.trigger_type) {
    case 'card_moved_to_column': {
      const columnId = rule.trigger_config.column_id as string | undefined;
      const name = (columnId && lookups.columnNames.get(columnId)) || FALLBACK;
      return `When a card moves to "${name}"`;
    }
    case 'checklist_completed':
      return "When a card's checklist reaches 100%";
    case 'due_date_passed':
      return "When a card's due date passes";
  }
}

function describeAction(rule: AutomationRule, lookups: RuleLookups): string {
  switch (rule.action_type) {
    case 'move_to_column': {
      const columnId = rule.action_config.column_id as string | undefined;
      const name = (columnId && lookups.columnNames.get(columnId)) || FALLBACK;
      return `move it to "${name}"`;
    }
    case 'add_label': {
      const labelId = rule.action_config.label_id as string | undefined;
      const name = (labelId && lookups.labelNames.get(labelId)) || FALLBACK;
      return `add the "${name}" label`;
    }
    case 'assign_user': {
      const userId = rule.action_config.user_id as string | null | undefined;
      if (!userId) return 'assign it to nobody';
      const name = lookups.memberNames.get(userId) || FALLBACK;
      return `assign it to ${name}`;
    }
  }
}

/** e.g. `When a card moves to "Done", assign it to nobody.` */
export function describeRule(rule: AutomationRule, lookups: RuleLookups): string {
  return `${describeTrigger(rule, lookups)}, ${describeAction(rule, lookups)}.`;
}
