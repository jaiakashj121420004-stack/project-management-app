import { z } from 'zod';
import type { ReminderChannel } from '@/types/database';

/**
 * Shared model for Pro custom-reminder offsets (P1). An offset is "how many
 * minutes before due_at to fire". The DB only requires `offset_minutes >= 0`
 * (the migration's CHECK); these add UX-level bounds + the quick-pick chips and
 * the label/channel copy the modal and the email function share.
 */

/** Largest offset we let the UI add — 28 days. The DB itself only requires >= 0. */
export const MAX_OFFSET_MINUTES = 28 * 24 * 60;

/** Quick-pick offsets (minutes) shown as chips in the Reminders section. */
export const QUICK_OFFSETS: { minutes: number; label: string }[] = [
  { minutes: 15, label: '15m' },
  { minutes: 30, label: '30m' },
  { minutes: 60, label: '1h' },
  { minutes: 120, label: '2h' },
  { minutes: 1440, label: '1 day' },
];

/** Units for the custom-offset input. */
export type OffsetUnit = 'minutes' | 'hours' | 'days';

export const OFFSET_UNIT_MINUTES: Record<OffsetUnit, number> = {
  minutes: 1,
  hours: 60,
  days: 1440,
};

export const CHANNEL_LABEL: Record<ReminderChannel, string> = {
  email: 'Email',
  push: 'Browser',
};

/** Human label for an offset, e.g. "At due time", "15 minutes before", "2 hours before". */
export function offsetLabel(minutes: number): string {
  if (minutes <= 0) return 'At due time';
  const parts: string[] = [];
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;
  if (days) parts.push(`${days} day${days === 1 ? '' : 's'}`);
  if (hours) parts.push(`${hours} hour${hours === 1 ? '' : 's'}`);
  if (mins) parts.push(`${mins} minute${mins === 1 ? '' : 's'}`);
  return `${parts.join(' ')} before`;
}

/** Validate a custom offset (amount + unit) into a bounded minute count. */
export const offsetInputSchema = z
  .object({
    // Coercion turns the text input into a number; '' → 0 (caught by min),
    // non-numeric → NaN (caught by int), so no custom type message is needed.
    amount: z.coerce.number().int('Whole numbers only.').min(1, 'Must be at least 1.'),
    unit: z.enum(['minutes', 'hours', 'days']),
  })
  .transform((value) => value.amount * OFFSET_UNIT_MINUTES[value.unit])
  .refine((minutes) => minutes >= 0 && minutes <= MAX_OFFSET_MINUTES, {
    message: 'That reminder is too far ahead (max 28 days).',
  });

/** A normalized offset-minutes value, validated against the DB CHECK + UI bound. */
export const offsetMinutesSchema = z
  .number()
  .int()
  .min(0)
  .max(MAX_OFFSET_MINUTES);

export const channelSchema = z.enum(['email', 'push']);
