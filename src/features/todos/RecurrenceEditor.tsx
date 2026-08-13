import { useState } from 'react';
import { format } from 'date-fns';
import { Calendar, CalendarClock, CalendarDays, Repeat2, Sparkles, X } from 'lucide-react';
import { ToolbarPopover } from '@/components/forms/ToolbarPopover';
import { SegmentedToggle } from '@/components/forms/SegmentedToggle';
import { GradientButton } from '@/components/buttons/GradientButton';
import { Tooltip } from '@/components/Tooltip';
import { cn } from '@/lib/cn';
import {
  WEEKDAY_FULL_LABELS,
  WEEKDAY_LABELS,
  defaultRuleFor,
  describeRule,
  type RecurrenceRule,
} from './recurrence';

interface RecurrenceEditorProps {
  open: boolean;
  onClose: () => void;
  trigger: React.ReactNode;
  /** null = this list doesn't repeat yet. */
  rule: RecurrenceRule | null;
  isPro: boolean;
  saving: boolean;
  onSave: (rule: RecurrenceRule) => void;
  onRemove: () => void;
}

const TODAY_KEY = format(new Date(), 'yyyy-MM-dd');

/**
 * The "ultra customisable, clear UI" repeat picker (feature request: custom
 * to-do recurrence). Four plain-language modes, each with just the controls it
 * needs — no cron syntax, no jargon. "Every day" is free; the other three
 * (specific weekdays, a day of the month, or every N days/weeks/months) are
 * Pro, matching the DB-side `enforce_recurrence_plan` gate.
 */
export function RecurrenceEditor({
  open,
  onClose,
  trigger,
  rule,
  isPro,
  saving,
  onSave,
  onRemove,
}: RecurrenceEditorProps) {
  const [draft, setDraft] = useState<RecurrenceRule>(rule ?? { type: 'daily' });

  // Reset the draft to the live rule each time the popover opens, so a
  // cancelled edit never leaks into the next open.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setDraft(rule ?? { type: 'daily' });
  }

  function setType(type: RecurrenceRule['type']) {
    if (type !== 'daily' && !isPro) return; // UI-level guard; DB trigger is the real gate
    setDraft(defaultRuleFor(type, TODAY_KEY));
  }

  function toggleWeekday(day: number) {
    if (draft.type !== 'weekly') return;
    const has = draft.weekdays.includes(day);
    const next = has ? draft.weekdays.filter((d) => d !== day) : [...draft.weekdays, day].sort();
    setDraft({ ...draft, weekdays: next });
  }

  const canSave =
    draft.type !== 'weekly' || draft.weekdays.length > 0;

  return (
    <ToolbarPopover open={open} onClose={onClose} trigger={trigger} title="Repeat">
      <div className="flex w-[19rem] max-w-full flex-col gap-4">
        <SegmentedToggle
          label="Repeat type"
          value={draft.type}
          onChange={setType}
          className="flex-wrap"
          options={[
            { value: 'daily', label: 'Every day', icon: <Calendar size={13} /> },
            { value: 'weekly', label: 'Days', icon: <CalendarDays size={13} /> },
            { value: 'monthly', label: 'Monthly', icon: <CalendarClock size={13} /> },
            { value: 'interval', label: 'Custom', icon: <Repeat2 size={13} /> },
          ]}
        />

        {!isPro && (
          <p className="flex items-start gap-1.5 rounded-xl border border-[var(--glass-border)] bg-[var(--glass-fill)] px-3 py-2 text-xs text-fg-muted">
            <Sparkles size={13} className="mt-0.5 shrink-0 text-[var(--accent-from)]" />
            Specific days, monthly, and custom intervals need Pro. Every day stays free.
          </p>
        )}

        {draft.type === 'weekly' && (
          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium text-fg-muted">Repeats on</p>
            <div className="flex gap-1.5">
              {/* WEEKDAY_LABELS and WEEKDAY_FULL_LABELS are both fixed 7-day
                  tuples, so `day` (this map's own index) is always in bounds. */}
              {WEEKDAY_LABELS.map((label, day) => (
                <Tooltip key={day} label={WEEKDAY_FULL_LABELS[day]!}>
                  <button
                    type="button"
                    disabled={!isPro}
                    onClick={() => toggleWeekday(day)}
                    aria-pressed={draft.weekdays.includes(day)}
                    className={cn(
                      'grid h-8 w-8 place-items-center rounded-full border text-xs font-semibold transition-colors disabled:opacity-40',
                      draft.weekdays.includes(day)
                        ? 'border-transparent bg-[linear-gradient(110deg,var(--accent-from),var(--accent-to))] text-[var(--accent-fg)]'
                        : 'border-[var(--glass-border)] text-fg-muted hover:text-fg',
                    )}
                  >
                    {label}
                  </button>
                </Tooltip>
              ))}
            </div>
          </div>
        )}

        {draft.type === 'monthly' && (
          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium text-fg-muted">Repeats on</p>
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-1.5 text-sm text-fg">
                <input
                  type="radio"
                  checked={draft.day !== 'last'}
                  disabled={!isPro}
                  onChange={() => setDraft({ type: 'monthly', day: 1 })}
                />
                Day
              </label>
              <input
                type="number"
                min={1}
                max={31}
                disabled={!isPro || draft.day === 'last'}
                value={draft.day === 'last' ? 1 : draft.day}
                onChange={(e) =>
                  setDraft({ type: 'monthly', day: Math.min(31, Math.max(1, Number(e.target.value) || 1)) })
                }
                className="h-8 w-16 rounded-lg border bg-[var(--field-bg)] px-2 text-sm text-fg focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--accent-from)] disabled:opacity-40"
              />
              <label className="flex items-center gap-1.5 text-sm text-fg">
                <input
                  type="radio"
                  checked={draft.day === 'last'}
                  disabled={!isPro}
                  onChange={() => setDraft({ type: 'monthly', day: 'last' })}
                />
                Last day of the month
              </label>
            </div>
          </div>
        )}

        {draft.type === 'interval' && (
          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium text-fg-muted">Repeats every</p>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={365}
                disabled={!isPro}
                value={draft.count}
                onChange={(e) =>
                  setDraft({ ...draft, count: Math.min(365, Math.max(1, Number(e.target.value) || 1)) })
                }
                className="h-8 w-16 rounded-lg border bg-[var(--field-bg)] px-2 text-sm text-fg focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--accent-from)] disabled:opacity-40"
              />
              <select
                value={draft.unit}
                disabled={!isPro}
                onChange={(e) => setDraft({ ...draft, unit: e.target.value as 'day' | 'week' | 'month' })}
                className="h-8 rounded-lg border bg-[var(--field-bg)] px-2 text-sm text-fg focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--accent-from)] disabled:opacity-40"
              >
                <option value="day">day(s)</option>
                <option value="week">week(s)</option>
                <option value="month">month(s)</option>
              </select>
            </div>
            <p className="text-xs text-fg-subtle">Counting from today, {format(new Date(), 'MMM d')}.</p>
          </div>
        )}

        <p className="rounded-lg bg-[var(--glass-fill)] px-2.5 py-1.5 text-xs text-fg-muted">
          {describeRule(draft)}
        </p>

        <div className="flex items-center justify-between gap-2">
          {rule ? (
            <button
              type="button"
              onClick={onRemove}
              className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-danger hover:bg-danger/10"
            >
              <X size={13} /> Stop repeating
            </button>
          ) : (
            <span />
          )}
          <GradientButton
            size="sm"
            isLoading={saving}
            disabled={!canSave || (draft.type !== 'daily' && !isPro)}
            onClick={() => onSave(draft)}
          >
            Save
          </GradientButton>
        </div>
      </div>
    </ToolbarPopover>
  );
}
