import { useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import {
  AlertCircle,
  CalendarClock,
  ListChecks,
  Percent,
  Plus,
  Target,
  Trash2,
} from 'lucide-react';
import { GlassPanel } from '@/components/glass/GlassPanel';
import { GradientButton } from '@/components/buttons/GradientButton';
import { Field } from '@/components/forms/Field';
import { DatePicker } from '@/components/forms/DatePicker';
import { GlassSelect, type GlassSelectOption } from '@/components/forms/GlassSelect';
import { SegmentedToggle, type SegmentOption } from '@/components/forms/SegmentedToggle';
import { Spinner } from '@/components/feedback/Spinner';
import { useAuth } from '@/hooks/useAuth';
import { useBoard } from '@/features/board/useBoard';
import { useCardExtras } from '@/features/board/useCardExtras';
import type { ChecklistItem, Goal } from '@/types/database';
import { goalChecklistCounts, goalProgress } from './progress';
import {
  fieldErrorsOf,
  goalFormSchema,
  type GoalFormInput,
  type GoalProgressTypeInput,
} from './schemas';
import { useCreateGoal, useDeleteGoal, useGoals, useUpdateGoal } from './useGoals';

const GOAL_LIMIT = 50;

const PROGRESS_OPTIONS: SegmentOption<GoalProgressTypeInput>[] = [
  // linked_checklist first — the default suggestion (Task 24): a goal that
  // updates itself as the team ticks off checklist items, not one someone has
  // to remember to move.
  { value: 'linked_checklist', label: 'Link to a checklist', icon: <ListChecks size={14} /> },
  { value: 'manual_percent', label: 'Set percentage', icon: <Percent size={14} /> },
];

const EMPTY_INPUT: GoalFormInput = {
  title: '',
  targetDate: null,
  progressType: 'linked_checklist',
  manualPercent: 50,
  linkedCardId: null,
};

/**
 * The project's "Goals" tab (Task 24) — a flat list of goals, each with a
 * title, an optional target date, and one self-updating or manually-set
 * progress bar. No Objective/Key-Result split, no nesting, no cycles: see
 * memory.md's decision log and reports/SIMPLICITY-GUARDRAIL.md for why this
 * stays this small on purpose. All access is membership-gated by RLS; this
 * component never filters by user.
 */
export function GoalsPanel({ projectId, canEdit }: { projectId: string; canEdit: boolean }) {
  const { user } = useAuth();
  const { data: goals, isLoading, isError } = useGoals(projectId);
  const { data: board } = useBoard(projectId);
  const { data: extras } = useCardExtras(projectId);

  const createGoal = useCreateGoal(projectId, user?.id ?? '');
  const updateGoal = useUpdateGoal(projectId);
  const deleteGoal = useDeleteGoal(projectId);

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<GoalFormInput>(EMPTY_INPUT);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const checklist = extras?.checklist ?? [];

  // "Card title — Column name", sorted the same way the board renders (column
  // position, then card position within it), so the picker matches what the
  // team sees on the Board tab.
  const cardOptions: GlassSelectOption<string>[] = useMemo(() => {
    if (!board) return [];
    const columnName = new Map(board.columns.map((column) => [column.id, column.name]));
    const columnOrder = new Map(board.columns.map((column, i) => [column.id, i]));
    return [...board.cards]
      .sort((a, b) => {
        const columnDelta =
          (columnOrder.get(a.column_id) ?? 0) - (columnOrder.get(b.column_id) ?? 0);
        return columnDelta !== 0 ? columnDelta : a.position - b.position;
      })
      .map((card) => ({
        value: card.id,
        label: `${card.title} — ${columnName.get(card.column_id) ?? 'Untitled column'}`,
      }));
  }, [board]);

  const atLimit = (goals?.length ?? 0) >= GOAL_LIMIT;

  function startCreate() {
    setEditingId(null);
    setDraft({ ...EMPTY_INPUT, linkedCardId: cardOptions[0]?.value ?? null });
    setErrors({});
    setFormError(null);
    setFormOpen(true);
  }

  function startEdit(goal: Goal) {
    setEditingId(goal.id);
    setDraft({
      title: goal.title,
      targetDate: goal.target_date,
      progressType: goal.progress_type,
      manualPercent: goal.manual_percent ?? 50,
      linkedCardId: goal.linked_card_id ?? cardOptions[0]?.value ?? null,
    });
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
    const parsed = goalFormSchema.safeParse(draft);
    if (!parsed.success) {
      setErrors(fieldErrorsOf(parsed.error));
      return;
    }
    setErrors({});
    try {
      if (editingId) {
        await updateGoal.mutateAsync({ id: editingId, ...parsed.data });
      } else {
        await createGoal.mutateAsync({ ...parsed.data, tempId: crypto.randomUUID() });
      }
      closeForm();
    } catch {
      setFormError('Could not save this goal. Please try again.');
    }
  }

  const saving = createGoal.isPending || updateGoal.isPending;

  if (isLoading) {
    return (
      <div className="grid place-items-center py-24">
        <Spinner size={32} />
      </div>
    );
  }

  if (isError) {
    return (
      <GlassPanel className="p-6 text-center text-fg-muted">
        Couldn&apos;t load this project&apos;s goals. Check your connection and try again.
      </GlassPanel>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="flex shrink-0 items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-fg-muted">
          <Target size={15} /> Goals
          <span className="text-fg-subtle">· {goals?.length ?? 0}</span>
        </span>
        {canEdit && !formOpen && (
          <GradientButton
            size="sm"
            leftIcon={<Plus size={15} />}
            onClick={startCreate}
            disabled={atLimit}
          >
            {atLimit ? `Goal limit reached (${GOAL_LIMIT})` : 'Add goal'}
          </GradientButton>
        )}
      </div>

      {formOpen && (
        <GoalForm
          draft={draft}
          onChange={setDraft}
          errors={errors}
          formError={formError}
          cardOptions={cardOptions}
          saving={saving}
          editing={Boolean(editingId)}
          onCancel={closeForm}
          onSave={() => void handleSave()}
        />
      )}

      {goals && goals.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {goals.map((goal) => (
            <GoalRow
              key={goal.id}
              goal={goal}
              checklist={checklist}
              canEdit={canEdit}
              onEdit={() => startEdit(goal)}
              onDelete={() => deleteGoal.mutate({ id: goal.id })}
            />
          ))}
        </ul>
      ) : (
        !formOpen && (
          <GlassPanel className="flex flex-col items-center gap-2 p-10 text-center">
            <span className="grid h-14 w-14 place-items-center rounded-2xl bg-[linear-gradient(135deg,var(--accent-from),var(--accent-to))] text-[var(--accent-fg)] shadow-[0_12px_26px_-12px_var(--accent-glow)]">
              <Target size={26} />
            </span>
            <p className="max-w-xs text-fg-muted">
              {canEdit
                ? 'No goals yet. Add one to track progress on something the team cares about — it can update itself as checklist items get checked off.'
                : 'No goals have been added to this project yet.'}
            </p>
            {canEdit && (
              <GradientButton leftIcon={<Plus size={16} />} onClick={startCreate}>
                Add goal
              </GradientButton>
            )}
          </GlassPanel>
        )
      )}
    </div>
  );
}

function GoalRow({
  goal,
  checklist,
  canEdit,
  onEdit,
  onDelete,
}: {
  goal: Goal;
  checklist: ChecklistItem[];
  canEdit: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const items = checklist;
  const percent = goalProgress(goal, items);
  const counts = goalChecklistCounts(goal, items);
  const unlinked = goal.progress_type === 'linked_checklist' && !goal.linked_card_id;

  return (
    <li>
      <GlassPanel className="flex flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <button
            type="button"
            onClick={canEdit ? onEdit : undefined}
            disabled={!canEdit}
            className="min-w-0 flex-1 text-left disabled:cursor-default"
          >
            <h3 className="truncate text-sm font-semibold text-fg">{goal.title}</h3>
            {goal.target_date && (
              <span className="mt-1 inline-flex items-center gap-1.5 text-xs text-fg-muted">
                <CalendarClock size={13} aria-hidden />
                Target: {format(parseISO(goal.target_date), 'MMM d, yyyy')}
              </span>
            )}
          </button>
          {canEdit && (
            <button
              type="button"
              aria-label="Delete goal"
              onClick={onDelete}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-fg-muted transition-colors hover:bg-danger/10 hover:text-danger"
            >
              <Trash2 size={15} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div
            className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--glass-fill)]"
            role="progressbar"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${goal.title} progress`}
          >
            <div
              className="h-full rounded-full bg-[linear-gradient(110deg,var(--accent-from),var(--accent-to))] transition-[width] duration-300"
              style={{ width: `${percent}%` }}
            />
          </div>
          <span className="w-10 shrink-0 text-right text-xs font-medium text-fg-muted">
            {percent}%
          </span>
        </div>

        <p className="text-xs text-fg-subtle">
          {unlinked
            ? 'Not linked to a checklist yet.'
            : counts
              ? `${counts.done}/${counts.total} checklist items done`
              : goal.progress_type === 'manual_percent'
                ? 'Set manually'
                : 'Linked checklist has no items yet.'}
        </p>
      </GlassPanel>
    </li>
  );
}

function GoalForm({
  draft,
  onChange,
  errors,
  formError,
  cardOptions,
  saving,
  editing,
  onCancel,
  onSave,
}: {
  draft: GoalFormInput;
  onChange: (next: GoalFormInput) => void;
  errors: Record<string, string>;
  formError: string | null;
  cardOptions: GlassSelectOption<string>[];
  saving: boolean;
  editing: boolean;
  onCancel: () => void;
  onSave: () => void;
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

      <Field
        label="Title"
        value={draft.title}
        maxLength={120}
        placeholder="e.g. Launch the new onboarding flow"
        onChange={(event) => onChange({ ...draft, title: event.target.value })}
        error={errors.title}
      />

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-fg-muted">Target date (optional)</span>
        <DatePicker
          label="Target date"
          value={draft.targetDate}
          onChange={(targetDate) => onChange({ ...draft, targetDate })}
        />
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-fg-muted">Progress</span>
        <SegmentedToggle
          label="Progress mode"
          value={draft.progressType}
          onChange={(progressType) => onChange({ ...draft, progressType })}
          options={PROGRESS_OPTIONS}
        />

        {draft.progressType === 'linked_checklist' ? (
          cardOptions.length === 0 ? (
            <p className="text-sm text-fg-subtle">
              Add a card with a checklist on the Board tab first, then link a goal to it.
            </p>
          ) : (
            <>
              <GlassSelect
                label="Linked card"
                value={draft.linkedCardId ?? ''}
                onChange={(linkedCardId) => onChange({ ...draft, linkedCardId })}
                options={cardOptions}
              />
              {errors.linkedCardId && <p className="text-sm text-danger">{errors.linkedCardId}</p>}
              <p className="text-xs text-fg-subtle">
                Progress is checked items ÷ total on this card&apos;s checklist — it updates on its
                own as the team works.
              </p>
            </>
          )
        ) : (
          <>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={draft.manualPercent ?? 0}
                onChange={(event) =>
                  onChange({ ...draft, manualPercent: Number(event.target.value) })
                }
                aria-label="Progress percentage"
                className="h-2 flex-1 accent-[var(--accent-from)]"
                style={{ accentColor: 'var(--accent-from)' }}
              />
              <span className="w-10 shrink-0 text-right text-sm font-medium text-fg">
                {draft.manualPercent ?? 0}%
              </span>
            </div>
            {errors.manualPercent && <p className="text-sm text-danger">{errors.manualPercent}</p>}
          </>
        )}
      </div>

      <div className="flex justify-end gap-2.5">
        <GradientButton type="button" variant="ghost" onClick={onCancel} disabled={saving}>
          Cancel
        </GradientButton>
        <GradientButton type="button" onClick={onSave} isLoading={saving}>
          {editing ? 'Save changes' : 'Add goal'}
        </GradientButton>
      </div>
    </GlassPanel>
  );
}
