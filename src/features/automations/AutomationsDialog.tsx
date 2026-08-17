import { useMemo, useState } from 'react';
import { AlertCircle, Plus, Trash2, Zap } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Modal } from '@/components/Modal';
import { GlassSelect, type GlassSelectOption } from '@/components/forms/GlassSelect';
import { GradientButton } from '@/components/buttons/GradientButton';
import { GlassPanel } from '@/components/glass/GlassPanel';
import { Spinner } from '@/components/feedback/Spinner';
import { toast } from '@/components/feedback/toast';
import { useBoard } from '@/features/board/useBoard';
import { useCardExtras } from '@/features/board/useCardExtras';
import { AssigneeField } from '@/features/board/AssigneeField';
import { useMembers } from '@/features/members/useMembers';
import type { AutomationRule } from '@/types/database';
import { describeRule, type RuleLookups } from './describeRule';
import { fromRule } from './api';
import {
  automationRuleInputSchema,
  fieldErrorsOf,
  type AutomationActionTypeInput,
  type AutomationRuleInput,
  type AutomationTriggerTypeInput,
} from './schemas';
import {
  useCreateAutomationRule,
  useAutomationRules,
  useDeleteAutomationRule,
  useToggleAutomationRule,
  useUpdateAutomationRule,
} from './useAutomations';

const RULE_LIMIT = 20;

const TRIGGER_OPTIONS: GlassSelectOption<AutomationTriggerTypeInput>[] = [
  { value: 'card_moved_to_column', label: 'A card moves to a column' },
  { value: 'checklist_completed', label: "A card's checklist reaches 100%" },
  { value: 'due_date_passed', label: "A card's due date passes" },
];

const ACTION_OPTIONS: GlassSelectOption<AutomationActionTypeInput>[] = [
  { value: 'move_to_column', label: 'Move the card to a column' },
  { value: 'add_label', label: 'Add a label to the card' },
  { value: 'assign_user', label: 'Assign the card to someone' },
];

const EMPTY_INPUT: AutomationRuleInput = {
  triggerType: 'card_moved_to_column',
  triggerColumnId: null,
  actionType: 'move_to_column',
  actionColumnId: null,
  actionLabelId: null,
  actionUserId: null,
};

interface AutomationsDialogProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  /** Only editors may create/edit/toggle/delete — RLS is the real gate; this
   *  just keeps the affordances off a viewer's screen (plan.md §6). */
  canEdit: boolean;
}

/**
 * The entire "Automations" surface (Task 23) — reached from the project's
 * overflow menu, never a Sidebar item (guardrail item 1), and never rendered
 * at all for a non-Pro project (the caller only mounts this behind
 * `isProBoard`, guardrail's "fully hidden, not shown-but-disabled" mandate).
 * Two dropdowns + a target picker per rule — no visual flowchart, no
 * conditions, no scripting. Every saved rule renders as one plain-language
 * sentence (describeRule.ts); the trigger_type/action_type/config JSON never
 * reaches the screen.
 */
export function AutomationsDialog({ open, onClose, projectId, canEdit }: AutomationsDialogProps) {
  const { data: board } = useBoard(projectId);
  const { data: extras } = useCardExtras(projectId);
  const { data: membersData } = useMembers(projectId);
  const { data: rules, isLoading } = useAutomationRules(projectId);

  const createRule = useCreateAutomationRule(projectId);
  const updateRule = useUpdateAutomationRule(projectId);
  const toggleRule = useToggleAutomationRule(projectId);
  const deleteRule = useDeleteAutomationRule(projectId);

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<AutomationRuleInput>(EMPTY_INPUT);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const columns = board?.columns ?? [];
  const labels = extras?.labels ?? [];

  // Depend on the underlying query data (stable across renders once loaded),
  // not the `?? []` fallbacks above, which are fresh array literals every
  // render and would otherwise bust this memo on every re-render.
  const lookups: RuleLookups = useMemo(
    () => ({
      columnNames: new Map((board?.columns ?? []).map((column) => [column.id, column.name])),
      labelNames: new Map((extras?.labels ?? []).map((label) => [label.id, label.name])),
      memberNames: new Map(
        (membersData?.members ?? []).map((member) => [
          member.userId,
          member.displayName ?? 'Member',
        ]),
      ),
    }),
    [board?.columns, extras?.labels, membersData?.members],
  );

  const columnOptions: GlassSelectOption<string>[] = columns.map((column) => ({
    value: column.id,
    label: column.name,
  }));
  const labelOptions: GlassSelectOption<string>[] = labels.map((label) => ({
    value: label.id,
    label: label.name,
  }));

  const atLimit = (rules?.length ?? 0) >= RULE_LIMIT;

  function startCreate() {
    setEditingId(null);
    setDraft({
      ...EMPTY_INPUT,
      triggerColumnId: columns[0]?.id ?? null,
      actionColumnId: columns[0]?.id ?? null,
      actionLabelId: labels[0]?.id ?? null,
    });
    setErrors({});
    setFormError(null);
    setFormOpen(true);
  }

  function startEdit(rule: AutomationRule) {
    setEditingId(rule.id);
    setDraft(fromRule(rule));
    setErrors({});
    setFormError(null);
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditingId(null);
  }

  async function handleSave() {
    setFormError(null);
    const parsed = automationRuleInputSchema.safeParse(draft);
    if (!parsed.success) {
      setErrors(fieldErrorsOf(parsed.error));
      return;
    }
    setErrors({});
    try {
      if (editingId) {
        await updateRule.mutateAsync({ id: editingId, ...parsed.data });
        toast.success('Automation updated.');
      } else {
        await createRule.mutateAsync({ ...parsed.data, tempId: crypto.randomUUID() });
        toast.success('Automation created.');
      }
      closeForm();
    } catch {
      setFormError('Could not save this automation. Please try again.');
    }
  }

  const saving = createRule.isPending || updateRule.isPending;
  const dataLoading = !board || !extras || !membersData;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Automations"
      description="Automatically do something on this board when a simple condition happens — no setup required to use the board without them."
      className="max-w-xl"
    >
      {!canEdit && (
        <p className="mb-4 text-sm text-fg-muted">
          Only editors and the board owner can add or change automations.
        </p>
      )}

      {isLoading || dataLoading ? (
        <div className="grid place-items-center py-10">
          <Spinner size={28} />
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {rules && rules.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {rules.map((rule) => (
                <RuleRow
                  key={rule.id}
                  rule={rule}
                  lookups={lookups}
                  canEdit={canEdit}
                  onEdit={() => startEdit(rule)}
                  onDelete={() => deleteRule.mutate({ id: rule.id })}
                  onToggle={(enabled) => toggleRule.mutate({ id: rule.id, enabled })}
                />
              ))}
            </ul>
          ) : (
            !formOpen && (
              <GlassPanel className="flex flex-col items-center gap-2 p-6 text-center">
                <Zap size={20} className="text-[var(--accent-from)]" aria-hidden />
                <p className="text-sm text-fg-muted">
                  No automations yet. Add one to have this board do something on its own — like
                  moving a card to Done when its checklist is finished.
                </p>
              </GlassPanel>
            )
          )}

          {formOpen ? (
            <RuleForm
              draft={draft}
              onChange={setDraft}
              errors={errors}
              formError={formError}
              columnOptions={columnOptions}
              labelOptions={labelOptions}
              projectId={projectId}
              saving={saving}
              editing={Boolean(editingId)}
              onCancel={closeForm}
              onSave={() => void handleSave()}
              noTargetsAvailable={
                (draft.actionType === 'move_to_column' ||
                  draft.triggerType === 'card_moved_to_column') &&
                columnOptions.length === 0
              }
            />
          ) : (
            canEdit && (
              <GradientButton
                type="button"
                variant="secondary"
                leftIcon={<Plus size={16} />}
                onClick={startCreate}
                disabled={atLimit}
              >
                {atLimit ? `Automation limit reached (${RULE_LIMIT})` : 'Add automation'}
              </GradientButton>
            )
          )}
        </div>
      )}
    </Modal>
  );
}

function RuleRow({
  rule,
  lookups,
  canEdit,
  onEdit,
  onDelete,
  onToggle,
}: {
  rule: AutomationRule;
  lookups: RuleLookups;
  canEdit: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: (enabled: boolean) => void;
}) {
  return (
    <li>
      <GlassPanel className={cn('flex items-center gap-3 p-3.5', !rule.enabled && 'opacity-60')}>
        <Toggle
          checked={rule.enabled}
          onChange={onToggle}
          disabled={!canEdit}
          label="Automation on"
        />
        <button
          type="button"
          onClick={onEdit}
          disabled={!canEdit}
          className="min-w-0 flex-1 text-left text-sm text-fg disabled:cursor-default"
        >
          <span className="line-clamp-2">{describeRule(rule, lookups)}</span>
        </button>
        {canEdit && (
          <button
            type="button"
            aria-label="Delete automation"
            onClick={onDelete}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-fg-muted transition-colors hover:bg-danger/10 hover:text-danger"
          >
            <Trash2 size={15} />
          </button>
        )}
      </GlassPanel>
    </li>
  );
}

function RuleForm({
  draft,
  onChange,
  errors,
  formError,
  columnOptions,
  labelOptions,
  projectId,
  saving,
  editing,
  onCancel,
  onSave,
  noTargetsAvailable,
}: {
  draft: AutomationRuleInput;
  onChange: (next: AutomationRuleInput) => void;
  errors: Record<string, string>;
  formError: string | null;
  columnOptions: GlassSelectOption<string>[];
  labelOptions: GlassSelectOption<string>[];
  projectId: string;
  saving: boolean;
  editing: boolean;
  onCancel: () => void;
  onSave: () => void;
  noTargetsAvailable: boolean;
}) {
  return (
    <GlassPanel className="flex flex-col gap-4 p-4">
      {formError && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-2xl border border-danger/30 bg-danger/10 px-3.5 py-3 text-sm text-danger"
        >
          <AlertCircle size={18} className="mt-px shrink-0" />
          <span>{formError}</span>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-fg-muted">When…</span>
        <GlassSelect
          label="Trigger"
          value={draft.triggerType}
          onChange={(triggerType) =>
            onChange({
              ...draft,
              triggerType,
              triggerColumnId: draft.triggerColumnId ?? columnOptions[0]?.value ?? null,
            })
          }
          options={TRIGGER_OPTIONS}
        />
        {draft.triggerType === 'card_moved_to_column' && (
          <GlassSelect
            label="Column"
            value={draft.triggerColumnId ?? ''}
            onChange={(triggerColumnId) => onChange({ ...draft, triggerColumnId })}
            options={columnOptions}
            disabled={columnOptions.length === 0}
          />
        )}
        {errors.triggerColumnId && <p className="text-sm text-danger">{errors.triggerColumnId}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-fg-muted">Then…</span>
        <GlassSelect
          label="Action"
          value={draft.actionType}
          onChange={(actionType) =>
            onChange({
              ...draft,
              actionType,
              actionColumnId: draft.actionColumnId ?? columnOptions[0]?.value ?? null,
              actionLabelId: draft.actionLabelId ?? labelOptions[0]?.value ?? null,
            })
          }
          options={ACTION_OPTIONS}
        />
        {draft.actionType === 'move_to_column' && (
          <>
            <GlassSelect
              label="Target column"
              value={draft.actionColumnId ?? ''}
              onChange={(actionColumnId) => onChange({ ...draft, actionColumnId })}
              options={columnOptions}
              disabled={columnOptions.length === 0}
            />
            {errors.actionColumnId && (
              <p className="text-sm text-danger">{errors.actionColumnId}</p>
            )}
          </>
        )}
        {draft.actionType === 'add_label' && (
          <>
            {labelOptions.length === 0 ? (
              <p className="text-sm text-fg-subtle">
                This board has no labels yet — add one on a card first.
              </p>
            ) : (
              <GlassSelect
                label="Label"
                value={draft.actionLabelId ?? ''}
                onChange={(actionLabelId) => onChange({ ...draft, actionLabelId })}
                options={labelOptions}
              />
            )}
            {errors.actionLabelId && <p className="text-sm text-danger">{errors.actionLabelId}</p>}
          </>
        )}
        {draft.actionType === 'assign_user' && (
          <>
            <AssigneeField
              projectId={projectId}
              value={draft.actionUserId ?? null}
              onChange={(actionUserId) => onChange({ ...draft, actionUserId })}
            />
            {errors.actionUserId && <p className="text-sm text-danger">{errors.actionUserId}</p>}
          </>
        )}
      </div>

      {noTargetsAvailable && (
        <p className="text-sm text-fg-subtle">
          Add a column to this board first to use this automation.
        </p>
      )}

      <div className="flex justify-end gap-2.5">
        <GradientButton type="button" variant="ghost" onClick={onCancel} disabled={saving}>
          Cancel
        </GradientButton>
        <GradientButton type="button" onClick={onSave} isLoading={saving}>
          {editing ? 'Save changes' : 'Add automation'}
        </GradientButton>
      </div>
    </GlassPanel>
  );
}

/** Accessible on/off switch — same markup as ReminderSettings.tsx's local
 *  Toggle (no shared component exists yet in this repo to import instead). */
function Toggle({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors',
        'disabled:cursor-not-allowed disabled:opacity-50',
        checked
          ? 'border-transparent bg-[linear-gradient(110deg,var(--accent-from),var(--accent-to))]'
          : 'border-[var(--glass-border)] bg-[var(--field-bg)]',
      )}
    >
      <span
        className={cn(
          'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
          checked ? 'translate-x-5' : 'translate-x-1',
        )}
      />
    </button>
  );
}
