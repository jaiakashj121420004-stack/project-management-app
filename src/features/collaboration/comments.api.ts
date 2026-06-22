import { supabase } from '@/lib/supabase';
import type { Comment } from '@/types/database';

/**
 * Supabase data layer for comments. Every call is governed by Row Level Security
 * (plan.md §6): members read a card's thread; any member of a *Pro* board may
 * post their own comment; authors (and owners/editors) may edit/delete. Nothing
 * here filters by user for security — the database does.
 */

/** A card's full thread (top-level + replies), oldest first. */
export async function fetchCardComments(cardId: string): Promise<Comment[]> {
  const { data, error } = await supabase
    .from('comments')
    .select('*')
    .eq('card_id', cardId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data;
}

export interface PostCommentInput {
  projectId: string;
  cardId: string;
  authorId: string;
  body: string;
  parentId: string | null;
  /** Member ids @mentioned in the body; recorded so the DB trigger notifies them. */
  mentionedUserIds: string[];
}

/**
 * Post a comment, then record its @mentions. The comment is the primary artifact:
 * if writing mentions fails (it shouldn't — RLS lets an author mention on their
 * own comment), we don't undo the saved comment. RLS rejects the insert outright
 * for a free board — that's the real Pro gate.
 */
export async function postComment(input: PostCommentInput): Promise<Comment> {
  const { data, error } = await supabase
    .from('comments')
    .insert({
      project_id: input.projectId,
      card_id: input.cardId,
      author_id: input.authorId,
      body: input.body,
      parent_id: input.parentId,
    })
    .select('*')
    .single();
  if (error) throw error;

  const mentions = input.mentionedUserIds.filter((id) => id !== input.authorId);
  if (mentions.length > 0) {
    // Best-effort: the comment is already saved; a mention failure only costs a
    // notification, never the comment itself.
    await supabase
      .from('comment_mentions')
      .insert(mentions.map((userId) => ({ comment_id: data.id, mentioned_user_id: userId })));
  }
  return data;
}

/** Edit your own comment body; stamps edited_at so the UI can show "(edited)". */
export async function editComment(id: string, body: string): Promise<Comment> {
  const { data, error } = await supabase
    .from('comments')
    .update({ body, edited_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

/** Delete a comment (cascades to its replies + mentions). */
export async function deleteComment(id: string): Promise<void> {
  const { error } = await supabase.from('comments').delete().eq('id', id);
  if (error) throw error;
}
