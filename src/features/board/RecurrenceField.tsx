import { useState } from 'react';
import { Repeat2 } from 'lucide-react';
import { GradientButton } from '@/components/buttons/GradientButton';
import { RecurrenceEditor } from '@/features/todos/RecurrenceEditor';
import { describeRule, type RecurrenceRule } from '@/lib/recurrence';

interface RecurrenceFieldProps {
  /** null = this card doesn't repeat. */
  rule: RecurrenceRule | null;
  /** Governed by the PROJECT owner's plan (useProjectIsPro), not the viewer's
   *  own — matches every other Pro gate on a shared board. */
  isPro: boolean;
  onChange: (rule: RecurrenceRule | null) => void;
}

/**
 * "Repeat" section for the card detail modal — reuses the to-do planner's
 * `RecurrenceEditor` popover as-is (it was already fully generic: no todo-
 * specific props or imports) rather than a second copy. Unlike a to-do list's
 * repeat (which mutates immediately, since it's its own DB table), a card's
 * `recurrence_rule` is just another field on the card, so this only tracks a
 * local draft — it's saved together with title/description/etc. by the same
 * "Save changes" submit as the rest of the form.
 */
export function RecurrenceField({ rule, isPro, onChange }: RecurrenceFieldProps) {
  const [open, setOpen] = useState(false);

  return (
    <section aria-label="Repeat" className="flex flex-col gap-2">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-fg">
        <Repeat2 size={16} aria-hidden /> Repeat
      </h3>
      <RecurrenceEditor
        open={open}
        onClose={() => setOpen(false)}
        rule={rule}
        isPro={isPro}
        saving={false}
        onSave={(next) => {
          onChange(next);
          setOpen(false);
        }}
        onRemove={() => {
          onChange(null);
          setOpen(false);
        }}
        trigger={
          <GradientButton
            type="button"
            variant="secondary"
            size="sm"
            leftIcon={<Repeat2 size={14} />}
            onClick={() => setOpen((o) => !o)}
          >
            {rule ? describeRule(rule) : "Doesn't repeat"}
          </GradientButton>
        }
      />
      {rule && (
        <p className="text-xs text-fg-muted">
          A fresh card is created each time this repeats — the checklist resets, but comments,
          attachments, and time entries stay with this card only.
        </p>
      )}
    </section>
  );
}
