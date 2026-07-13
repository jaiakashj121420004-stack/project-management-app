import { useState, type KeyboardEvent } from 'react';
import { Check, Plus, Tags, Trash2 } from 'lucide-react';
import { cn } from '@/lib/cn';
import {
  DEFAULT_LABEL_COLOR,
  LABEL_COLOR_NAMES,
  labelHex,
  withAlpha,
  type LabelColor,
} from '@/lib/labelColors';
import type { Label } from '@/types/database';
import { LabelPill } from './LabelPill';
import { labelNameSchema } from './schemas';
import {
  useAttachLabel,
  useCreateLabel,
  useDeleteLabel,
  useDetachLabel,
} from './useCardExtras';

interface CardLabelsSectionProps {
  projectId: string;
  cardId: string;
  labels: Label[];
  attachedLabelIds: Set<string>;
}

/**
 * The card's labels: attached pills (click × to detach) plus an expandable
 * picker to toggle existing project labels and create new ones. Project labels
 * are shared, so creating/deleting one here affects the whole project; every
 * change is optimistic via useCardExtras.
 */
export function CardLabelsSection({
  projectId,
  cardId,
  labels,
  attachedLabelIds,
}: CardLabelsSectionProps) {
  const attach = useAttachLabel(projectId);
  const detach = useDetachLabel(projectId);
  const createLabel = useCreateLabel(projectId);
  const deleteLabel = useDeleteLabel(projectId);
  const [picking, setPicking] = useState(false);

  const attached = labels.filter((label) => attachedLabelIds.has(label.id));

  function toggle(label: Label) {
    if (attachedLabelIds.has(label.id)) detach.mutate({ cardId, labelId: label.id });
    else attach.mutate({ cardId, labelId: label.id });
  }

  async function handleCreate(name: string, color: LabelColor) {
    const created = await createLabel.mutateAsync({ name, color, tempId: crypto.randomUUID() });
    // Attach with the real id once the server row exists (avoids an FK race).
    attach.mutate({ cardId, labelId: created.id });
  }

  return (
    <section aria-label="Labels" className="flex flex-col gap-2.5">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-fg">
        <Tags size={16} aria-hidden /> Labels
      </h3>

      <div className="flex flex-wrap items-center gap-2">
        {attached.map((label) => (
          <LabelPill
            key={label.id}
            name={label.name}
            color={label.color}
            onRemove={() => detach.mutate({ cardId, labelId: label.id })}
          />
        ))}
        <button
          type="button"
          onClick={() => setPicking((open) => !open)}
          aria-expanded={picking}
          className="inline-flex items-center gap-1 rounded-full border border-dashed border-[var(--glass-border)] px-2.5 py-0.5 text-xs font-medium text-fg-muted transition-colors hover:bg-[var(--glass-fill)] hover:text-fg"
        >
          <Plus size={13} /> {attached.length === 0 ? 'Add label' : 'Edit'}
        </button>
      </div>

      {picking && (
        <div className="flex flex-col gap-2 rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-fill)] p-3">
          {labels.length > 0 && (
            <ul className="flex flex-col gap-0.5">
              {labels.map((label) => {
                const isOn = attachedLabelIds.has(label.id);
                return (
                  <li key={label.id} className="group flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => toggle(label)}
                      aria-pressed={isOn}
                      className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-1.5 py-1 text-left transition-colors hover:bg-[var(--glass-fill)]"
                    >
                      <span
                        className={cn(
                          'grid h-4 w-4 shrink-0 place-items-center rounded border',
                          isOn ? 'border-transparent text-[var(--accent-fg)]' : 'border-[var(--glass-border)] text-transparent',
                        )}
                        style={isOn ? { backgroundColor: labelHex(label.color) } : undefined}
                      >
                        <Check size={11} strokeWidth={3} aria-hidden />
                      </span>
                      <LabelPill name={label.name} color={label.color} />
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete label ${label.name}`}
                      onClick={() => deleteLabel.mutate({ id: label.id })}
                      className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-fg-subtle opacity-0 transition-all hover:bg-danger/10 hover:text-danger group-hover:opacity-100"
                    >
                      <Trash2 size={13} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <LabelCreator onCreate={handleCreate} />
        </div>
      )}
    </section>
  );
}

/** Inline new-label form: name + a swatch color picker. */
function LabelCreator({ onCreate }: { onCreate: (name: string, color: LabelColor) => Promise<void> }) {
  const [name, setName] = useState('');
  const [color, setColor] = useState<LabelColor>(DEFAULT_LABEL_COLOR);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const parsed = labelNameSchema.safeParse(name);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Invalid name.');
      return;
    }
    setError(null);
    try {
      await onCreate(parsed.data, color);
      setName('');
    } catch {
      setError('Could not create that label. The name may already be in use.');
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      // Create without submitting the enclosing card form (which would save +
      // close the modal). This block is a plain div, not a <form>.
      event.preventDefault();
      void submit();
    }
  }

  return (
    <div className="flex flex-col gap-2 border-t border-[var(--glass-border)] pt-2">
      <div className="flex items-center gap-2">
        <input
          value={name}
          maxLength={40}
          placeholder="New label name"
          onChange={(event) => setName(event.target.value)}
          onKeyDown={handleKeyDown}
          aria-label="New label name"
          className="h-9 min-w-0 flex-1 rounded-xl border bg-[var(--field-bg)] px-3 text-sm text-fg placeholder:text-fg-subtle focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--accent-from)]"
        />
        <button
          type="button"
          onClick={() => void submit()}
          aria-label="Create label"
          className="btn-3d grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[linear-gradient(110deg,var(--accent-from),var(--accent-to))] text-[var(--accent-fg)]"
        >
          <Plus size={16} />
        </button>
      </div>
      <div role="radiogroup" aria-label="Label color" className="flex flex-wrap gap-1.5">
        {LABEL_COLOR_NAMES.map((swatch) => {
          const selected = swatch === color;
          const hex = labelHex(swatch);
          return (
            <button
              key={swatch}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={swatch}
              onClick={() => setColor(swatch)}
              className={cn(
                'grid h-6 w-6 place-items-center rounded-full ring-2 transition-transform hover:scale-110',
                selected ? 'ring-white' : 'ring-transparent',
              )}
              style={{ backgroundColor: hex, boxShadow: selected ? `0 0 0 2px ${withAlpha(hex, 0.4)}` : undefined }}
            >
              {selected && <Check size={13} strokeWidth={3} className="text-[var(--accent-fg)]" aria-hidden />}
            </button>
          );
        })}
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
