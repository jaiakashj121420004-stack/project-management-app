import { supabase } from '@/lib/supabase';
import type { CardReminder, ReminderChannel } from '@/types/database';

/**
 * Supabase data layer for Pro custom reminders (P1). Every call is governed by
 * Row Level Security: members may read a card's reminders, owners/editors of a
 * *Pro* board may create them, and the browser is denied the dispatch ledger
 * entirely. Nothing here filters by user for security — the database does.
 */

/** All reminders on a card, soonest-offset first (for the card modal). */
export async function fetchCardReminders(cardId: string): Promise<CardReminder[]> {
  const { data, error } = await supabase
    .from('card_reminders')
    .select('*')
    .eq('card_id', cardId)
    .order('offset_minutes', { ascending: true });
  if (error) throw error;
  return data;
}

/** Add an offset to a card. RLS rejects this for a free board (the Pro gate). */
export async function insertCardReminder(input: {
  cardId: string;
  offsetMinutes: number;
  channel: ReminderChannel;
  createdBy: string;
}): Promise<CardReminder> {
  const { data, error } = await supabase
    .from('card_reminders')
    .insert({
      card_id: input.cardId,
      offset_minutes: input.offsetMinutes,
      channel: input.channel,
      created_by: input.createdBy,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function deleteCardReminder(id: string): Promise<void> {
  const { error } = await supabase.from('card_reminders').delete().eq('id', id);
  if (error) throw error;
}

/** A browser-channel reminder joined to its card, for the in-app notification poller. */
export interface UpcomingPushReminder {
  id: string;
  offset_minutes: number;
  card_id: string;
  card_title: string;
  /** The card's due_at (ISO); never null — null-due_at cards are filtered out. */
  due_at: string;
}

/**
 * Every `channel = 'push'` reminder on a dated card assigned to `userId`. Done as
 * two plain queries (rather than an embedded filter, which supabase-js can't type)
 * and joined client-side. RLS still scopes both to rows the user can see; the
 * assignee filter narrows to the few cards a reminder could fire for.
 */
export async function fetchUpcomingPushReminders(userId: string): Promise<UpcomingPushReminder[]> {
  const { data: cards, error: cardsError } = await supabase
    .from('cards')
    .select('id, title, due_at')
    .eq('assignee_id', userId)
    .not('due_at', 'is', null);
  if (cardsError) throw cardsError;
  if (!cards || cards.length === 0) return [];

  const cardById = new Map(cards.map((card) => [card.id, card]));

  const { data: reminders, error: remindersError } = await supabase
    .from('card_reminders')
    .select('id, card_id, offset_minutes')
    .eq('channel', 'push')
    .in(
      'card_id',
      cards.map((card) => card.id),
    );
  if (remindersError) throw remindersError;

  return (reminders ?? []).flatMap((reminder) => {
    const card = cardById.get(reminder.card_id);
    return card && card.due_at
      ? [
          {
            id: reminder.id,
            offset_minutes: reminder.offset_minutes,
            card_id: card.id,
            card_title: card.title,
            due_at: card.due_at,
          },
        ]
      : [];
  });
}
