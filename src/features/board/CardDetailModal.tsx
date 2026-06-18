import { useMemo, useState, type FormEvent } from 'react';
import { AlertCircle } from 'lucide-react';
import { Modal } from '@/components/Modal';
import { Field } from '@/components/forms/Field';
import { TextArea } from '@/components/forms/TextArea';
import { GradientButton } from '@/components/buttons/GradientButton';
import type { AccentName } from '@/lib/accents';
import type { Card } from '@/types/database';
import { cardDetailSchema, fieldErrorsOf } from './schemas';
import { useCardExtras } from './useCardExtras';
import { DueDateField } from './DueDateField';
import { CardLabelsSection } from './CardLabelsSection';
import { Checklist } from './Checklist';

export interface CardDetailValues {
  title: string;
  description: string | null;
  due_date: string | null;
}

interface CardDetailModalProps {
  card: Card | null;
  open: boolean;
  projectId: string;
  accent: AccentName;
  onClose: () => void;
  onSave: (id: string, values: CardDetailValues) => Promise<void>;
  isPending: boolean;
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
  onClose,
  onSave,
  isPending,
}: CardDetailModalProps) {
  return (
    <Modal open={open} onClose={onClose} accent={accent} title="Card">
      {card ? (
        <CardDetailForm
          key={card.id}
          card={card}
          projectId={projectId}
          onClose={onClose}
          onSave={onSave}
          isPending={isPending}
        />
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
  isPending,
}: {
  card: Card;
  projectId: string;
  onClose: () => void;
  onSave: CardDetailModalProps['onSave'];
  isPending: boolean;
}) {
  const [title, setTitle] = useState(card.title);
  const [description, setDescription] = useState(card.description ?? '');
  const [dueDate, setDueDate] = useState<string | null>(card.due_date);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

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
      });
      onClose();
    } catch {
      setFormError('Could not save this card. Please try again.');
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

      <CardLabelsSection
        projectId={projectId}
        cardId={card.id}
        labels={projectLabels}
        attachedLabelIds={attachedLabelIds}
      />

      <Checklist projectId={projectId} cardId={card.id} items={checklistItems} />

      <div className="flex justify-end gap-2.5 border-t border-[var(--glass-border)] pt-4">
        <GradientButton type="button" variant="ghost" onClick={onClose} disabled={isPending}>
          Cancel
        </GradientButton>
        <GradientButton type="submit" isLoading={isPending}>
          Save changes
        </GradientButton>
      </div>
    </form>
  );
}
