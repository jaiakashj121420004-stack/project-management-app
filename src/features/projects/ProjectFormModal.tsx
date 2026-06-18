import { useState, type FormEvent } from 'react';
import { AlertCircle } from 'lucide-react';
import { Modal } from '@/components/Modal';
import { Field } from '@/components/forms/Field';
import { TextArea } from '@/components/forms/TextArea';
import { GradientButton } from '@/components/buttons/GradientButton';
import type { AccentName } from '@/lib/accents';
import { AccentPicker } from './AccentPicker';
import { fieldErrorsOf, projectFormSchema, type ProjectFormInput } from './schemas';

interface ProjectFormModalProps {
  open: boolean;
  onClose: () => void;
  mode: 'create' | 'edit';
  initial?: { name: string; description: string | null; accent: AccentName };
  onSubmit: (values: ProjectFormInput) => Promise<void>;
  isPending: boolean;
}

/** Create or edit a project: name, description, and an accent-gradient picker.
 *  Validates with Zod (UX); the DB + RLS are the real guard (plan.md §6).
 *
 *  State is seeded lazily from `initial`; the parent passes a changing `key` so
 *  the form remounts (and re-seeds) on each open — no reset effect needed. */
export function ProjectFormModal({
  open,
  onClose,
  mode,
  initial,
  onSubmit,
  isPending,
}: ProjectFormModalProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [accent, setAccent] = useState<AccentName>(initial?.accent ?? 'aurora');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    const parsed = projectFormSchema.safeParse({ name, description, accent });
    if (!parsed.success) {
      setErrors(fieldErrorsOf(parsed.error));
      return;
    }
    setErrors({});
    try {
      await onSubmit(parsed.data);
    } catch {
      setFormError('Could not save your project. Please try again.');
    }
  }

  const isEdit = mode === 'edit';

  return (
    <Modal
      open={open}
      onClose={onClose}
      accent={accent}
      title={isEdit ? 'Edit project' : 'New project'}
      description={
        isEdit ? 'Update the details and accent of this project.' : 'Spin up a fresh workspace.'
      }
    >
      {formError && (
        <div
          role="alert"
          className="mb-4 flex items-start gap-2.5 rounded-2xl border border-danger/30 bg-danger/10 px-3.5 py-3 text-sm text-danger"
        >
          <AlertCircle size={18} className="mt-px shrink-0" />
          <span>{formError}</span>
        </div>
      )}

      <form onSubmit={(event) => void handleSubmit(event)} noValidate className="flex flex-col gap-4">
        <Field
          label="Name"
          placeholder="e.g. Product Launch"
          value={name}
          onChange={(event) => setName(event.target.value)}
          error={errors.name}
          autoFocus
          maxLength={80}
        />
        <TextArea
          label="Description"
          placeholder="What's this project about? (optional)"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          error={errors.description}
          maxLength={500}
        />
        <AccentPicker value={accent} onChange={setAccent} />

        <div className="mt-1 flex justify-end gap-2.5">
          <GradientButton type="button" variant="ghost" onClick={onClose} disabled={isPending}>
            Cancel
          </GradientButton>
          <GradientButton type="submit" accent={accent} isLoading={isPending}>
            {isEdit ? 'Save changes' : 'Create project'}
          </GradientButton>
        </div>
      </form>
    </Modal>
  );
}
