import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { BellPlus, Plus, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { GlassSelect } from '@/components/forms/GlassSelect';
import { ProGate } from '@/features/billing';
import { useAuth } from '@/hooks/useAuth';
import type { ReminderChannel } from '@/types/database';
import {
  CHANNEL_LABEL,
  offsetInputSchema,
  offsetLabel,
  QUICK_OFFSETS,
  type OffsetUnit,
} from './offsets';
import {
  useAddCardReminder,
  useCardReminders,
  useDeleteCardReminder,
} from './useCardReminders';

const CHANNEL_OPTIONS = [
  { value: 'email' as const, label: CHANNEL_LABEL.email },
  { value: 'push' as const, label: CHANNEL_LABEL.push },
];

const UNIT_OPTIONS = [
  { value: 'minutes' as const, label: 'minutes' },
  { value: 'hours' as const, label: 'hours' },
  { value: 'days' as const, label: 'days' },
];

/**
 * Pro custom-reminder editor for a card: multiple arbitrary offsets on the email
 * or browser channel. Gated behind <ProGate> — free users get an upgrade card
 * instead (their single day-based reminder lives in Profile → Reminders). The
 * real gate is RLS + project_is_pro on `card_reminders` (plan.md §6).
 */
export function RemindersSection({ cardId, dueAt }: { cardId: string; dueAt: string | null }) {
  return (
    <section aria-label="Reminders" className="flex flex-col gap-2">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-fg">
        <BellPlus size={16} aria-hidden /> Reminders
      </h3>
      <ProGate
        title="Custom reminders are a Pro feature"
        reason="Set a due time and get reminded at your own offsets — like 2 hours and 15 minutes before — on email or in your browser."
      >
        <RemindersEditor cardId={cardId} dueAt={dueAt} />
      </ProGate>
    </section>
  );
}

function RemindersEditor({ cardId, dueAt }: { cardId: string; dueAt: string | null }) {
  const { user } = useAuth();
  const { data: reminders } = useCardReminders(cardId);
  const add = useAddCardReminder(cardId);
  const remove = useDeleteCardReminder(cardId);

  const [channel, setChannel] = useState<ReminderChannel>('email');
  const [amount, setAmount] = useState('');
  const [unit, setUnit] = useState<OffsetUnit>('hours');
  const [error, setError] = useState<string | null>(null);

  const list = reminders ?? [];

  const existsFor = (offsetMinutes: number, ch: ReminderChannel) =>
    list.some((r) => r.offset_minutes === offsetMinutes && r.channel === ch);

  function addOffset(offsetMinutes: number) {
    if (!user || existsFor(offsetMinutes, channel)) return;
    setError(null);
    add.mutate({ offsetMinutes, channel, createdBy: user.id, tempId: crypto.randomUUID() });
  }

  function handleCustomAdd() {
    const parsed = offsetInputSchema.safeParse({ amount, unit });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Enter a valid amount.');
      return;
    }
    if (existsFor(parsed.data, channel)) {
      setError('That reminder already exists.');
      return;
    }
    addOffset(parsed.data);
    setAmount('');
  }

  function fireTimeLabel(offsetMinutes: number): string | null {
    if (!dueAt) return null;
    const fireAt = new Date(parseISO(dueAt).getTime() - offsetMinutes * 60_000);
    return format(fireAt, 'MMM d, h:mm a');
  }

  return (
    <div className="flex flex-col gap-3">
      {!dueAt && (
        <p className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass-fill)] px-3 py-2 text-xs text-fg-muted">
          Set a due <span className="font-medium text-fg">date and time</span> above to schedule
          these reminders.
        </p>
      )}

      {/* Channel for new reminders. */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-fg-muted">Deliver via</span>
        <GlassSelect
          label="Reminder channel"
          size="sm"
          value={channel}
          onChange={setChannel}
          options={CHANNEL_OPTIONS}
          className="w-32"
        />
      </div>

      {/* Quick-pick offsets. */}
      <div className="flex flex-wrap gap-1.5">
        {QUICK_OFFSETS.map((quick) => {
          const already = existsFor(quick.minutes, channel);
          return (
            <button
              key={quick.minutes}
              type="button"
              onClick={() => addOffset(quick.minutes)}
              disabled={already}
              className={cn(
                'inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                already
                  ? 'cursor-not-allowed border-[var(--glass-border)] text-fg-subtle opacity-60'
                  : 'border-[var(--glass-border)] text-fg-muted hover:border-[color:var(--accent-from)] hover:text-fg',
              )}
            >
              <Plus size={12} aria-hidden /> {quick.label}
            </button>
          );
        })}
      </div>

      {/* Custom offset. */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="number"
          min={1}
          inputMode="numeric"
          value={amount}
          onChange={(event) => {
            setAmount(event.target.value);
            setError(null);
          }}
          onKeyDown={(event) => {
            // Enter adds the offset rather than submitting the card form.
            if (event.key === 'Enter') {
              event.preventDefault();
              handleCustomAdd();
            }
          }}
          aria-label="Custom reminder amount"
          placeholder="e.g. 90"
          className="h-10 w-24 rounded-xl border border-[var(--glass-border)] bg-[var(--field-bg)] px-3 text-sm text-fg outline-none transition-colors focus:border-[color:var(--accent-from)] focus:ring-2 focus:ring-[var(--accent-from)]"
        />
        <GlassSelect
          label="Custom reminder unit"
          size="md"
          value={unit}
          onChange={setUnit}
          options={UNIT_OPTIONS}
          className="w-28"
        />
        <span className="text-xs text-fg-muted">before</span>
        <button
          type="button"
          onClick={handleCustomAdd}
          className="inline-flex h-10 items-center gap-1 rounded-xl border border-[var(--glass-border)] px-3 text-sm font-medium text-fg-muted transition-colors hover:border-[color:var(--accent-from)] hover:text-fg"
        >
          <Plus size={14} aria-hidden /> Add
        </button>
      </div>

      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}

      {/* Existing reminders. */}
      {list.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {list.map((reminder) => {
            const fireAt = fireTimeLabel(reminder.offset_minutes);
            return (
              <li
                key={reminder.id}
                className="flex items-center justify-between gap-2 rounded-xl border border-[var(--glass-border)] bg-[var(--field-bg)] px-3 py-2"
              >
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-medium text-fg">
                    {offsetLabel(reminder.offset_minutes)}
                  </span>
                  <span className="text-xs text-fg-muted">
                    {CHANNEL_LABEL[reminder.channel]}
                    {fireAt ? ` · fires ${fireAt}` : ''}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => remove.mutate({ id: reminder.id })}
                  aria-label={`Remove ${offsetLabel(reminder.offset_minutes)} reminder`}
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-fg-subtle transition-colors hover:bg-danger/10 hover:text-danger"
                >
                  <X size={15} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
