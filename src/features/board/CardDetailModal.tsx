import { useMemo, useState, type FormEvent } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CalendarClock,
  Check,
  ListChecks,
  Tags,
  Trash2,
} from 'lucide-react';
import { Modal } from '@/components/Modal';
import { Field } from '@/components/forms/Field';
import { TextArea } from '@/components/forms/TextArea';
import { GradientButton } from '@/components/buttons/GradientButton';
import { Badge } from '@/components/Badge';
import { cn } from '@/lib/cn';
import { formatPriority, priorityPillClass } from '@/lib/priority';
import type { AccentName } from '@/lib/accents';
import type { Card } from '@/types/database';
import { cardDetailSchema, fieldErrorsOf } from './schemas';
import { useCardExtras } from './useCardExtras';
import { dueStatus, formatDueLabel, type DueStatus } from './due';
import { byPosition } from './ordering';
import { LabelPill } from './LabelPill';
import { DueDateField } from './DueDateField';
import { PriorityField } from './PriorityField';
import { CardLabelsSection } from './CardLabelsSection';
import { Checklist } from './Checklist';

export interface CardDetailValues {
  title: string;
  description: string | null;
  due_date: string | null;
  priority: number | null;
}

interface CardDetailModalProps {
  card: Card | null;
  open: boolean;
  projectId: string;
  accent: AccentName;
  /** Owners/editors get the editable form; viewers get a read-only view. */
  canEdit: boolean;
  onClose: () => void;
  onSave: (id: string, values: CardDetailValues) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  isPending: boolean;
  isDeleting: boolean;
}

/**
 * Open a card to edit it. Title, description, and due date are committed
 * together with "Save changes"; labels and checklist items mutate immediately
 * (optimistic) since they're list operations. All card extras read from the one
 * useCardExtras cache the board shares.
 */
export function CardDetailModal({
  card,
  open,
  projectId,
  accent,
  canEdit,
  onClose,
  onSave,
  onDelete,
  isPending,
  isDeleting,
}: CardDetailModalProps) {
  return (
    <Modal open={open} onClose={onClose} accent={accent} title="Card">
      {card ? (
        canEdit ? (
          <CardDetailForm
            key={card.id}
            card={card}
            projectId={projectId}
            onClose={onClose}
            onSave={onSave}
            onDelete={onDelete}
            isPending={isPending}
            isDeleting={isDeleting}
          />
        ) : (
          <CardReadOnlyView key={card.id} card={card} projectId={projectId} onClose={onClose} />
        )
      ) : null}
    </Modal>
  );
}

/** Keyed by card id so it re-seeds whenever a different card opens. */
function CardDetailForm({
  card,
  projectId,
  onClose,
  onSave,
  onDelete,
  isPending,
  isDeleting,
}: {
  card: Card;
  projectId: string;
  onClose: () => void;
  onSave: CardDetailModalProps['onSave'];
  onDelete: CardDetailModalProps['onDelete'];
  isPending: boolean;
  isDeleting: boolean;
}) {
  const [title, setTitle] = useState(card.title);
  const [description, setDescription] = useState(card.description ?? '');
  const [dueDate, setDueDate] = useState<string | null>(card.due_date);
  const [priority, setPriority] = useState<number | null>(card.priority);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const { data: extras } = useCardExtras(projectId);
  const projectLabels = extras?.labels ?? [];
  const checklistItems = useMemo(
    () => (extras?.checklist ?? []).filter((item) => item.card_id === card.id),
    [extras?.checklist, card.id],
  );
  const attachedLabelIds = useMemo(
    () =>
      new Set(
        (extras?.cardLabels ?? [])
          .filter((link) => link.card_id === card.id)
          .map((link) => link.label_id),
      ),
    [extras?.cardLabels, card.id],
  );

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    const parsed = cardDetailSchema.safeParse({ title, description });
    if (!parsed.success) {
      setErrors(fieldErrorsOf(parsed.error));
      return;
    }
    setErrors({});
    try {
      await onSave(card.id, {
        title: parsed.data.title,
        description: parsed.data.description.trim() || null,
        due_date: dueDate,
        priority,
      });
      onClose();
    } catch {
      setFormError('Could not save this card. Please try again.');
    }
  }

  async function handleDelete() {
    setDeleteError(null);
    try {
      await onDelete(card.id);
      // On success the parent closes the modal; nothing more to do here.
    } catch {
      setDeleteError('Could not delete this card. Please try again.');
    }
  }

  return (
    <form
      onSubmit={(event) => void handleSubmit(event)}
      noValidate
      className="-mr-2 flex max-h-[72vh] flex-col gap-5 overflow-y-auto pr-2"
    >
      {formError && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-2xl border border-danger/30 bg-danger/10 px-3.5 py-3 text-sm text-danger"
        >
          <AlertCircle size={18} className="mt-px shrink-0" />
          <span>{formError}</span>
        </div>
      )}

      <div className="flex flex-col gap-4">
        <Field
          label="Title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          error={errors.title}
          maxLength={200}
          autoFocus
        />
        <TextArea
          label="Description"
          placeholder="Add more detail… (optional)"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          error={errors.description}
          className="min-h-[120px]"
          maxLength={5000}
        />
      </div>

      <DueDateField value={dueDate} onChange={setDueDate} />

      <PriorityField value={priority} onChange={setPriority} />

      <CardLabelsSection
        projectId={projectId}
        cardId={card.id}
        labels={projectLabels}
        attachedLabelIds={attachedLabelIds}
      />

      <Checklist projectId={projectId} cardId={card.id} items={checklistItems} />

      {confirmingDelete ? (
        <div className="flex flex-col gap-3 border-t border-danger/30 pt-4">
          <div className="flex items-start gap-2.5 text-sm text-fg-muted">
            <AlertTriangle size={18} className="mt-px shrink-0 text-danger" />
            <span>
              Delete <span className="font-semibold text-fg">{card.title}</span>? This can&apos;t be
              undone.
            </span>
          </div>
          {deleteError && (
            <p role="alert" className="text-sm text-danger">
              {deleteError}
            </p>
          )}
          <div className="flex justify-end gap-2.5">
            <GradientButton
              type="button"
              variant="ghost"
              onClick={() => setConfirmingDelete(false)}
              disabled={isDeleting}
            >
              Cancel
            </GradientButton>
            <GradientButton
              type="button"
              accent="ember"
              leftIcon={<Trash2 size={16} />}
              isLoading={isDeleting}
              onClick={() => void handleDelete()}
            >
              Delete card
            </GradientButton>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2.5 border-t border-[var(--glass-border)] pt-4">
          <GradientButton
            type="button"
            variant="ghost"
            leftIcon={<Trash2 size={16} />}
            onClick={() => setConfirmingDelete(true)}
            disabled={isPending || isDeleting}
            className="text-danger hover:bg-danger/10 hover:text-danger"
          >
            Delete
          </GradientButton>
          <div className="flex gap-2.5">
            <GradientButton type="button" variant="ghost" onClick={onClose} disabled={isPending}>
              Cancel
            </GradientButton>
            <GradientButton type="submit" isLoading={isPending}>
              Save changes
            </GradientButton>
          </div>
        </div>
      )}
    </form>
  );
}

const DUE_TONE: Record<DueStatus, 'danger' | 'warning' | 'neutral'> = {
  overdue: 'danger',
  soon: 'warning',
  upcoming: 'neutral',
};

/** Read-only card view for viewers: the same details, no editing affordances.
 *  Reads the shared useCardExtras cache like the editable form, so labels +
 *  checklist stay in sync with realtime updates. */
function CardReadOnlyView({
  card,
  projectId,
  onClose,
}: {
  card: Card;
  projectId: string;
  onClose: () => void;
}) {
  const { data: extras } = useCardExtras(projectId);

  const checklist = useMemo(
    () => (extras?.checklist ?? []).filter((item) => item.card_id === card.id).sort(byPosition),
    [extras?.checklist, card.id],
  );
  const attachedIds = useMemo(
    () =>
      new Set(
        (extras?.cardLabels ?? [])
          .filter((link) => link.card_id === card.id)
          .map((link) => link.label_id),
      ),
    [extras?.cardLabels, card.id],
  );
  const labels = (extras?.labels ?? []).filter((label) => attachedIds.has(label.id));
  const done = checklist.filter((item) => item.is_done).length;
  const total = checklist.length;

  return (
    <div className="-mr-2 flex max-h-[72vh] flex-col gap-5 overflow-y-auto pr-2">
      <div className="flex flex-col gap-3">
        <h3 className="font-display text-title font-semibold text-fg">{card.title}</h3>
        {card.description && (
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-fg-muted">
            {card.description}
          </p>
        )}
      </div>

      {(card.due_date || card.priority != null) && (
        <div className="flex flex-wrap items-center gap-2">
          {card.due_date && (
            <Badge tone={DUE_TONE[dueStatus(card.due_date)]}>
              <CalendarClock size={13} /> {formatDueLabel(card.due_date)}
            </Badge>
          )}
          {card.priority != null && (
            <span
              className={cn(
                'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold',
                priorityPillClass(card.priority),
              )}
            >
              {formatPriority(card.priority)}
            </span>
          )}
        </div>
      )}

      {labels.length > 0 && (
        <section className="flex flex-col gap-2">
          <h4 className="flex items-center gap-2 text-sm font-semibold text-fg">
            <Tags size={16} aria-hidden /> Labels
          </h4>
          <div className="flex flex-wrap gap-2">
            {labels.map((label) => (
              <LabelPill key={label.id} name={label.name} color={label.color} />
            ))}
          </div>
        </section>
      )}

      {total > 0 && (
        <section className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h4 className="flex items-center gap-2 text-sm font-semibold text-fg">
              <ListChecks size={16} aria-hidden /> Checklist
            </h4>
            <span className="text-xs font-medium text-fg-muted">
              {done}/{total}
            </span>
          </div>
          <ul className="flex flex-col gap-1">
            {checklist.map((item) => (
              <li key={item.id} className="flex items-center gap-2 text-sm">
                <span
                  className={cn(
                    'grid h-4 w-4 shrink-0 place-items-center rounded border',
                    item.is_done
                      ? 'border-transparent bg-[linear-gradient(110deg,var(--accent-from),var(--accent-to))] text-white'
                      : 'border-[var(--glass-border)] text-transparent',
                  )}
                >
                  <Check size={11} strokeWidth={3} aria-hidden />
                </span>
                <span className={cn(item.is_done ? 'text-fg-subtle line-through' : 'text-fg')}>
                  {item.text}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="flex items-center justify-between gap-3 border-t border-[var(--glass-border)] pt-4">
        <Badge tone="neutral">Read-only</Badge>
        <GradientButton type="button" variant="secondary" onClick={onClose}>
          Close
        </GradientButton>
      </div>
    </div>
  );
}
