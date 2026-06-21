import { useState, type FormEvent } from 'react';
import { AlertCircle, Lightbulb, MessageSquareHeart, Sparkles } from 'lucide-react';
import { TextArea } from '@/components/forms/TextArea';
import { GradientButton } from '@/components/buttons/GradientButton';
import { cn } from '@/lib/cn';
import type { FeedbackKind } from '@/types/database';
import { feedbackSchema, fieldErrorsOf } from './schemas';
import { useSubmitFeedback } from './useFeedback';

interface FeedbackFormProps {
  /** Secondary action (e.g. a modal's Cancel). Omit on a full page. */
  onCancel?: () => void;
  /**
   * Called when the user dismisses the success screen. Provide it in a modal
   * (closes the modal); omit on a page so the success screen offers "Send
   * another" and resets in place instead.
   */
  onDone?: () => void;
}

const KINDS: { value: FeedbackKind; label: string }[] = [
  { value: 'feedback', label: 'Feedback' },
  { value: 'feature', label: 'Feature idea' },
];

/**
 * The feedback / feature-idea form: a segmented kind toggle plus a Zod-validated
 * message, swapping to a thank-you state on success. Shared by the quick-access
 * modal (user menu) and the full Feedback page so the two never drift apart.
 * The submission is stamped with the user's id (api.ts) and scoped by RLS.
 */
export function FeedbackForm({ onCancel, onDone }: FeedbackFormProps) {
  const submit = useSubmitFeedback();
  const [kind, setKind] = useState<FeedbackKind>('feedback');
  const [message, setMessage] = useState('');
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  function reset() {
    setKind('feedback');
    setMessage('');
    setFieldError(undefined);
    setFormError(null);
    setSent(false);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    const parsed = feedbackSchema.safeParse({ kind, message });
    if (!parsed.success) {
      setFieldError(fieldErrorsOf(parsed.error).message);
      return;
    }
    setFieldError(undefined);
    try {
      await submit.mutateAsync(parsed.data);
      setSent(true);
    } catch {
      setFormError('Could not send your note. Please try again.');
    }
  }

  if (sent) {
    return (
      <div className="flex flex-col items-center gap-4 py-6 text-center">
        <span className="grid h-16 w-16 place-items-center rounded-full bg-[linear-gradient(135deg,var(--accent-from),var(--accent-to))] text-white shadow-[0_14px_30px_-12px_var(--accent-glow)]">
          <Sparkles size={28} />
        </span>
        <div>
          <h2 className="font-display text-title font-semibold text-fg">
            Thanks! We read every note.
          </h2>
          <p className="mt-1 text-sm text-fg-muted">Your input shapes where Aurora goes next.</p>
        </div>
        <GradientButton onClick={() => (onDone ? onDone() : reset())} className="mt-1">
          {onDone ? 'Done' : 'Send another'}
        </GradientButton>
      </div>
    );
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

      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-sm font-medium text-fg-muted">
          What kind of note is this?
        </legend>
        <div className="glass inline-flex w-full rounded-2xl p-1" role="group">
          {KINDS.map((option) => {
            const Icon = option.value === 'feature' ? Lightbulb : MessageSquareHeart;
            const active = kind === option.value;
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={active}
                onClick={() => setKind(option.value)}
                className={cn(
                  'inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3.5 py-2',
                  'text-sm font-medium transition-colors',
                  active
                    ? 'bg-[linear-gradient(135deg,var(--accent-from),var(--accent-to))] text-white shadow-[0_8px_18px_-10px_var(--accent-glow)]'
                    : 'text-fg-muted hover:text-fg',
                )}
              >
                <Icon size={15} />
                {option.label}
              </button>
            );
          })}
        </div>
      </fieldset>

      <TextArea
        label="Your message"
        placeholder={
          kind === 'feature'
            ? 'Describe the feature you would love to see...'
            : 'Share what is on your mind...'
        }
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        error={fieldError}
        maxLength={4000}
        className="min-h-[140px]"
      />

      <div className="mt-1 flex justify-end gap-2.5">
        {onCancel && (
          <GradientButton
            type="button"
            variant="ghost"
            onClick={onCancel}
            disabled={submit.isPending}
          >
            Cancel
          </GradientButton>
        )}
        <GradientButton type="submit" isLoading={submit.isPending}>
          Send
        </GradientButton>
      </div>
    </form>
  );
}
