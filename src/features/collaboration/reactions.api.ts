import { supabase } from '@/lib/supabase';
import type { Reaction, ReactionTarget } from '@/types/database';

/**
 * Supabase data layer for emoji reactions on a comment or a card. RLS: members
 * read; a member of a *Pro* board adds their own; anyone removes their own.
 */

export async function fetchReactions(
  targetType: ReactionTarget,
  targetId: string,
): Promise<Reaction[]> {
  const { data, error } = await supabase
    .from('reactions')
    .select('*')
    .eq('target_type', targetType)
    .eq('target_id', targetId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data;
}

export interface AddReactionInput {
  targetType: ReactionTarget;
  targetId: string;
  userId: string;
  emoji: string;
}

export async function addReaction(input: AddReactionInput): Promise<Reaction> {
  const { data, error } = await supabase
    .from('reactions')
    .insert({
      target_type: input.targetType,
      target_id: input.targetId,
      user_id: input.userId,
      emoji: input.emoji,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function removeReaction(id: string): Promise<void> {
  const { error } = await supabase.from('reactions').delete().eq('id', id);
  if (error) throw error;
}
