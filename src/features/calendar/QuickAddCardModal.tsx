import { useState, type FormEvent } from 'react';
import { format, parseISO } from 'date-fns';
import { Modal } from '@/components/Modal';
import { Field } from '@/components/forms/Field';
import { GlassSelect, type GlassSelectOption } from '@/components/forms/GlassSelect';
import { GradientButton } from '@/components/buttons/GradientButton';
import { cardTitleSchema } from '@/features/board/schemas';
import { combineDueAt } from '@/lib/dueAt';
import type { Project } from '@/types/database';
import { useCreateQuickCard } from './useCalendar';

interface QuickAddCardModalProps {
  open: boolean;
  onClose: () => void;
  /** `YYYY-MM-DD` — the day that was clicked/tapped. */
  dateKey: string;
  /** `HH:mm`, or null for an all-day card (from the all-day row's "+ Add"). */
  initialTime: string | null;
  projects: Project[];
  defaultProjectId: string;
}

/**
 * The Calendar's "click an empty slot to create" flow (Day view time grid +
 * all-day row) — a deliberately small form (title, project, time), not the
 * full card modal: description/priority/assignee/recurrence are all still one
 * click away by opening the card right after it's created. Always lands in
 * the chosen project's first column; see createQuickCard's doc comment.
 *
 * The caller (DayView) remounts this component with a fresh `key` each time a
 * new slot is clicked, so its fields always start from that slot's values —
 * no reset-on-open effect needed (https://react.dev/learn/you-might-not-need-an-effect).
 */
export function QuickAddCardModal({
  open,
  onClose,
  dateKey,
  initialTime,
  projects,
  defaultProjectId,
}: QuickAddCardModalProps) {
  const [title, setTitle] = useState('');
  const [projectId, setProjectId] = useState(defaultProjectId);
  const [time, setTime] = useState(initialTime ?? '');
  const [error, setError] = useState<string | null>(null);
  const createCard = useCreateQuickCard();

  const projectOptions: GlassSelectOption<string>[] = projects.map((project) => ({
    value: project.id,
    label: project.name,
  }));

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const parsed = cardTitleSchema.safeParse(title);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Give the card a title.');
      return;
    }
    if (!projectId) {
      setError('Pick a project.');
      return;
    }
    setError(null);
    try {
      await createCard.mutateAsync({
        projectId,
        title: parsed.data,
        dueDate: dateKey,
        dueAt: time ? combineDueAt(dateKey, time) : null,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the card.');
    }
  }

  const dayLabel = (() => {
    try {
      return format(parseISO(dateKey), 'EEEE, MMMM d');
    } catch {
      return dateKey;
    }
  })();

  return (
    <Modal open={open} onClose={onClose} title="New card" description={dayLabel}>
      <form onSubmit={(event) => void handleSubmit(event)} className="flex flex-col gap-4">
        <Field
          label="Title"
          autoFocus
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="What needs doing?"
        />

        {projectOptions.length > 0 ? (
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-fg-muted">Project</span>
            <GlassSelect
              label="Project"
              value={projectId}
              onChange={setProjectId}
              options={projectOptions}
            />
          </div>
        ) : (
          <p className="text-sm text-fg-muted">Create a project first, then cards can be added here.</p>
        )}

        <Field
          label="Time (optional)"
          type="time"
          value={time}
          onChange={(event) => setTime(event.target.value)}
        />

        {error && <p className="text-sm text-danger">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <GradientButton type="button" variant="secondary" onClick={onClose}>
            Cancel
          </GradientButton>
          <GradientButton type="submit" isLoading={createCard.isPending} disabled={projectOptions.length === 0}>
            Add card
          </GradientButton>
        </div>
      </form>
    </Modal>
  );
}
