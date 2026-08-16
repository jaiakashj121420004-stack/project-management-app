import { useState, type FormEvent } from 'react';
import { AlertCircle } from 'lucide-react';
import { Modal } from '@/components/Modal';
import { Field } from '@/components/forms/Field';
import { TextArea } from '@/components/forms/TextArea';
import { EmojiPicker } from '@/components/forms/EmojiPicker';
import { GradientButton } from '@/components/buttons/GradientButton';
import { toast } from '@/components/feedback/toast';
import { useBoard } from '@/features/board/useBoard';
import { useCardExtras } from '@/features/board/useCardExtras';
import { snapshotProjectPayload } from './captureTemplate';
import { fieldErrorsOf, projectTemplateInputSchema } from './templateSchemas';
import { useCreateProjectTemplate } from './useProjectTemplates';

interface SaveAsTemplateDialogProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  projectName: string;
}

/**
 * The entire "template builder": no separate authoring screen, no
 * field-by-field configuration — the user already built the real board, this
 * just snapshots its columns + starter cards (title, checklist text, label
 * name/color) as a reusable template and asks for a name (+ optional
 * description/icon), the same minimal field set ProjectFormModal itself uses.
 * Live due dates, assignees, comments, and attachments never leave the board.
 */
export function SaveAsTemplateDialog({
  open,
  onClose,
  projectId,
  projectName,
}: SaveAsTemplateDialogProps) {
  const { data: board } = useBoard(projectId);
  const { data: extras } = useCardExtras(projectId);
  const createTemplate = useCreateProjectTemplate();

  const [name, setName] = useState(projectName);
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  // Re-seed the draft from the project's current name each time the dialog
  // (re)opens, so a second save starts fresh rather than from a stale draft
  // (the same render-time re-seed pattern as NameDialog).
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setName(projectName);
      setDescription('');
      setIcon(null);
      setErrors({});
      setFormError(null);
    }
  }

  const loading = !board || !extras;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    if (!board || !extras) {
      setFormError('Still loading this board — try again in a moment.');
      return;
    }
    const payload = snapshotProjectPayload({
      columns: board.columns,
      cards: board.cards,
      checklist: extras.checklist,
      labels: extras.labels,
      cardLabels: extras.cardLabels,
    });
    const parsed = projectTemplateInputSchema.safeParse({ name, description, icon, payload });
    if (!parsed.success) {
      setErrors(fieldErrorsOf(parsed.error));
      return;
    }
    setErrors({});
    try {
      await createTemplate.mutateAsync({
        name: parsed.data.name,
        description: parsed.data.description?.trim() || null,
        icon: parsed.data.icon ?? null,
        payload: parsed.data.payload,
        tempId: crypto.randomUUID(),
      });
      toast.success('Template saved.');
      onClose();
    } catch {
      setFormError('Could not save this template. Please try again.');
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Save as template"
      description="Snapshot this board's columns and starter cards to reuse later — due dates, assignees, and comments aren't included."
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
        <div className="flex items-end gap-2.5">
          <EmojiPicker
            value={icon}
            onSelect={setIcon}
            ariaLabel="Template icon"
            buttonClassName="h-11 w-11 shrink-0 border border-[var(--glass-border)] bg-[var(--field-bg)]"
          />
          <div className="min-w-0 flex-1">
            <Field
              label="Name"
              placeholder="Template name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              error={errors.name}
              autoFocus
              maxLength={80}
            />
          </div>
        </div>
        <TextArea
          label="Description"
          placeholder="What's this template for? (optional)"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          error={errors.description}
          maxLength={200}
        />

        <div className="mt-1 flex justify-end gap-2.5">
          <GradientButton
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={createTemplate.isPending}
          >
            Cancel
          </GradientButton>
          <GradientButton type="submit" isLoading={createTemplate.isPending} disabled={loading}>
            Save template
          </GradientButton>
        </div>
      </form>
    </Modal>
  );
}
