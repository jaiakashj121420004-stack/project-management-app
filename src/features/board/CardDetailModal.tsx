import { useState, type FormEvent } from 'react';
import { AlertCircle, ListChecks, Tags, UserPlus } from 'lucide-react';
import { Modal } from '@/components/Modal';
import { Field } from '@/components/forms/Field';
import { TextArea } from '@/components/forms/TextArea';
import { GradientButton } from '@/components/buttons/GradientButton';
import type { AccentName } from '@/lib/accents';
import type { Card } from '@/types/database';
import { cardDetailSchema, fieldErrorsOf } from './schemas';

interface CardDetailModalProps {
  card: Card | null;
  open: boolean;
  accent: AccentName;
  onClose: () => void;
  onSave: (id: string, values: { title: string; description: string | null }) => Promise<void>;
  isPending: boolean;
}

/**
 * Open a card to edit its title + description (Phase 4). The lower section is a
 * deliberate placeholder for Phase 5 — checklists, due dates, labels, and
 * assignee — so the layout already has room for them.
 */
export function CardDetailModal({
  card,
  open,
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
  onClose,
  onSave,
  isPending,
}: {
  card: Card;
  onClose: () => void;
  onSave: CardDetailModalProps['onSave'];
  isPending: boolean;
}) {
  const [title, setTitle] = useState(card.title);
  const [description, setDescription] = useState(card.description ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

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
      });
      onClose();
    } catch {
      setFormError('Could not save this card. Please try again.');
    }
  }

  return (
    <form onSubmit={(event) => void handleSubmit(event)} noValidate className="flex flex-col gap-4">
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
        className="min-h-[140px]"
        maxLength={5000}
      />

      {/* Phase 5 lives here: checklists, due dates, labels, assignee. */}
      <section
        aria-label="Coming in Phase 5"
        className="rounded-2xl border border-dashed border-[var(--glass-border)] px-4 py-3"
      >
        <p className="text-xs font-medium uppercase tracking-wide text-fg-subtle">Coming soon</p>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-fg-muted">
          <span className="inline-flex items-center gap-1.5">
            <ListChecks size={15} /> Checklists
          </span>
          <span className="inline-flex items-center gap-1.5">
            <AlertCircle size={15} /> Due dates
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Tags size={15} /> Labels
          </span>
          <span className="inline-flex items-center gap-1.5">
            <UserPlus size={15} /> Assignee
          </span>
        </div>
      </section>

      <div className="mt-1 flex justify-end gap-2.5">
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
