import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Pencil, Reply, Trash2 } from 'lucide-react';
import { Avatar } from '@/components/Avatar';
import { cn } from '@/lib/cn';
import type { Comment } from '@/types/database';
import type { MemberWithProfile } from '@/features/members/api';
import { MentionText } from './MentionText';
import { ReactionBar } from './ReactionBar';
import { CommentComposer, type ComposerMember } from './CommentComposer';
import { useDeleteComment, useEditComment } from './useComments';

interface CommentItemProps {
  comment: Comment;
  members: MemberWithProfile[];
  composerMembers: ComposerMember[];
  currentUserId: string | undefined;
  /** Owner/editor may moderate anyone's comment. */
  canModerate: boolean;
  /** Pro board + member: may add reactions. */
  canReact: boolean;
  projectId: string;
  cardId: string;
  isReply?: boolean;
  /** Provided for top-level comments only. */
  onReply?: (commentId: string) => void;
}

function timeAgo(iso: string): string {
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true });
  } catch {
    return '';
  }
}

/** A single comment: author, body (with mentions), reactions, and own/moderator actions. */
export function CommentItem({
  comment,
  members,
  composerMembers,
  currentUserId,
  canModerate,
  canReact,
  projectId,
  cardId,
  isReply = false,
  onReply,
}: CommentItemProps) {
  const author = members.find((member) => member.userId === comment.author_id);
  const name = author?.displayName ?? 'Member';
  const isMine = currentUserId === comment.author_id;
  const canEditThis = isMine;
  const canDeleteThis = isMine || canModerate;

  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const edit = useEditComment(projectId, cardId);
  const remove = useDeleteComment(projectId, cardId);

  return (
    <div className={cn('flex gap-2.5', isReply && 'ml-9')}>
      <Avatar name={name} src={author?.avatarUrl} size={isReply ? 28 : 32} className="mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-semibold text-fg">{name}</span>
          <span className="text-xs text-fg-subtle">{timeAgo(comment.created_at)}</span>
          {comment.edited_at && <span className="text-xs text-fg-subtle">(edited)</span>}
        </div>

        {editing ? (
          <div className="mt-1.5">
            <CommentComposer
              members={composerMembers}
              initialBody={comment.body}
              submitLabel="Save"
              autoFocus
              busy={edit.isPending}
              onCancel={() => setEditing(false)}
              onSubmit={(body) => {
                edit.mutate(
                  { id: comment.id, body },
                  { onSuccess: () => setEditing(false) },
                );
              }}
            />
          </div>
        ) : (
          <div className="mt-0.5 text-sm leading-relaxed text-fg-muted">
            <MentionText body={comment.body} members={members} />
          </div>
        )}

        {!editing && (
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <ReactionBar targetType="comment" targetId={comment.id} canReact={canReact} />

            {onReply && !isReply && (
              <ActionButton icon={Reply} onClick={() => onReply(comment.id)}>
                Reply
              </ActionButton>
            )}
            {canEditThis && (
              <ActionButton icon={Pencil} onClick={() => setEditing(true)}>
                Edit
              </ActionButton>
            )}
            {canDeleteThis &&
              (confirmingDelete ? (
                <span className="inline-flex items-center gap-1.5 text-xs">
                  <span className="text-fg-muted">Delete?</span>
                  <button
                    type="button"
                    onClick={() => remove.mutate({ id: comment.id })}
                    className="font-semibold text-danger hover:underline"
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingDelete(false)}
                    className="font-medium text-fg-subtle hover:text-fg"
                  >
                    No
                  </button>
                </span>
              ) : (
                <ActionButton icon={Trash2} tone="danger" onClick={() => setConfirmingDelete(true)}>
                  Delete
                </ActionButton>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ActionButton({
  icon: Icon,
  onClick,
  children,
  tone = 'default',
}: {
  icon: typeof Reply;
  onClick: () => void;
  children: string;
  tone?: 'default' | 'danger';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1 text-xs font-medium transition-colors',
        tone === 'danger' ? 'text-fg-subtle hover:text-danger' : 'text-fg-subtle hover:text-fg',
      )}
    >
      <Icon size={13} aria-hidden />
      {children}
    </button>
  );
}
