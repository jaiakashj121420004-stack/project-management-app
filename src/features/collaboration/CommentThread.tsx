import { useState } from 'react';
import { MessageSquare } from 'lucide-react';
import { Spinner } from '@/components/feedback/Spinner';
import { useAuth } from '@/hooks/useAuth';
import { ProGate } from '@/features/billing';
import { useMembers, useMyRole } from '@/features/members/useMembers';
import type { Comment } from '@/types/database';
import { CommentComposer, type ComposerMember } from './CommentComposer';
import { CommentItem } from './CommentItem';
import { useCardComments, usePostComment } from './useComments';
import { useProjectIsPro } from './useProjectIsPro';
import { resolveMentionedUserIds } from './mentions';

/**
 * Threaded discussion for a card. Pro-gated on the BOARD owner's plan (so a
 * member of a free board sees the upgrade CTA, matching what RLS will allow).
 * Two levels deep: top-level comments + their replies; replying always targets
 * the top-level comment so threads stay shallow.
 */
export function CommentThread({ projectId, cardId }: { projectId: string; cardId: string }) {
  const { user } = useAuth();
  const { data: isProBoard, isLoading: proLoading } = useProjectIsPro(projectId);
  const { data: comments = [] } = useCardComments(projectId, cardId);
  const { data: membersData } = useMembers(projectId);
  const role = useMyRole(projectId);
  const post = usePostComment(projectId, cardId);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);

  const members = membersData?.members ?? [];
  const composerMembers: ComposerMember[] = members.map((member) => ({
    userId: member.userId,
    displayName: member.displayName,
    avatarUrl: member.avatarUrl,
  }));
  const canModerate = role === 'owner' || role === 'editor';
  const canReact = Boolean(isProBoard);

  const topLevel = comments.filter((comment) => !comment.parent_id);
  const repliesByParent = new Map<string, Comment[]>();
  for (const comment of comments) {
    if (!comment.parent_id) continue;
    const list = repliesByParent.get(comment.parent_id) ?? [];
    list.push(comment);
    repliesByParent.set(comment.parent_id, list);
  }

  function submit(body: string, parentId: string | null) {
    if (!user) return;
    post.mutate(
      {
        authorId: user.id,
        body,
        parentId,
        mentionedUserIds: resolveMentionedUserIds(body, members),
        tempId: crypto.randomUUID(),
      },
      { onSuccess: () => setReplyingTo(null) },
    );
  }

  return (
    <section className="flex flex-col gap-3 border-t border-[var(--glass-border)] pt-4">
      <h4 className="flex items-center gap-2 text-sm font-semibold text-fg">
        <MessageSquare size={16} aria-hidden /> Discussion
        {topLevel.length + repliesByParent.size > 0 && (
          <span className="text-xs font-medium text-fg-subtle">({comments.length})</span>
        )}
      </h4>

      {proLoading ? (
        <div className="flex justify-center py-4">
          <Spinner size={20} />
        </div>
      ) : (
        <ProGate
          isPro={isProBoard}
          title="Comments are a Pro feature"
          reason="Upgrade to Pro to discuss cards with your team — threaded comments, @mentions, and emoji reactions, all in realtime."
        >
          <div className="flex flex-col gap-4">
            <CommentComposer members={composerMembers} busy={post.isPending} onSubmit={(body) => submit(body, null)} />

            {topLevel.length === 0 ? (
              <p className="text-sm text-fg-subtle">No comments yet — start the discussion.</p>
            ) : (
              <ul className="flex flex-col gap-4">
                {topLevel.map((comment) => (
                  <li key={comment.id} className="flex flex-col gap-3">
                    <CommentItem
                      comment={comment}
                      members={members}
                      composerMembers={composerMembers}
                      currentUserId={user?.id}
                      canModerate={canModerate}
                      canReact={canReact}
                      projectId={projectId}
                      cardId={cardId}
                      onReply={(id) => setReplyingTo((current) => (current === id ? null : id))}
                    />
                    {(repliesByParent.get(comment.id) ?? []).map((reply) => (
                      <CommentItem
                        key={reply.id}
                        comment={reply}
                        members={members}
                        composerMembers={composerMembers}
                        currentUserId={user?.id}
                        canModerate={canModerate}
                        canReact={canReact}
                        projectId={projectId}
                        cardId={cardId}
                        isReply
                      />
                    ))}
                    {replyingTo === comment.id && (
                      <div className="ml-9">
                        <CommentComposer
                          members={composerMembers}
                          autoFocus
                          submitLabel="Reply"
                          placeholder="Write a reply… use @ to mention"
                          busy={post.isPending}
                          onCancel={() => setReplyingTo(null)}
                          onSubmit={(body) => submit(body, comment.id)}
                        />
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </ProGate>
      )}
    </section>
  );
}
