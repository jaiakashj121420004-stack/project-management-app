import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Check, RotateCcw, Sparkles, UserCheck, X } from 'lucide-react';
import { GradientButton } from '@/components/buttons/GradientButton';
import { GlassSelect } from '@/components/forms/GlassSelect';
import { useAuth } from '@/hooks/useAuth';
import { UpgradeModal } from '@/features/billing';
import { useMembers } from '@/features/members/useMembers';
import { useUpdateCardReview } from '@/features/board/useBoard';
import type { Card } from '@/types/database';
import { ReviewBadge } from './ReviewBadge';
import { useProjectIsPro } from './useProjectIsPro';

interface ReviewControlProps {
  card: Card;
  projectId: string;
  /** Owners/editors may drive the review flow; viewers see state only. */
  canEdit: boolean;
}

/**
 * The card's review flow: request a review (pick a member), then approve or
 * request changes. Pro-gated on the board owner's plan; free boards get a compact
 * upgrade affordance instead of the full control. Writes are optimistic; a DB
 * trigger handles the activity-log + notification side effects.
 */
export function ReviewControl({ card, projectId, canEdit }: ReviewControlProps) {
  const { user } = useAuth();
  const { data: isProBoard } = useProjectIsPro(projectId);
  const { data: membersData } = useMembers(projectId);
  const update = useUpdateCardReview(projectId);
  const [reviewerId, setReviewerId] = useState('');
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  const members = membersData?.members ?? [];
  const nameOf = (id: string | null) =>
    (id ? members.find((member) => member.userId === id)?.displayName : null) ?? 'a member';

  const status = card.review_status;

  function setReview(patch: Parameters<typeof update.mutate>[0]) {
    update.mutate(patch);
  }

  function clearReview() {
    setReview({
      id: card.id,
      review_status: 'none',
      review_assignee_id: null,
      reviewed_by: null,
      reviewed_at: null,
    });
  }

  // --- Locked (free board): a compact upgrade affordance ----------------------
  if (!isProBoard) {
    return (
      <section className="flex flex-col gap-2 border-t border-[var(--glass-border)] pt-4">
        <Header />
        <button
          type="button"
          onClick={() => setUpgradeOpen(true)}
          className="inline-flex w-fit items-center gap-1.5 rounded-full border border-[var(--accent-from)]/40 bg-[var(--accent-from)]/10 px-3 py-1.5 text-xs font-semibold text-[var(--accent-from)] transition-colors hover:bg-[var(--accent-from)]/15"
        >
          <Sparkles size={13} aria-hidden /> Request review · Pro
        </button>
        <UpgradeModal
          open={upgradeOpen}
          onClose={() => setUpgradeOpen(false)}
          reason="Request reviews, approve work, and ask for changes — code-review style — on any card."
        />
      </section>
    );
  }

  // --- Active: full control ---------------------------------------------------
  return (
    <section className="flex flex-col gap-2.5 border-t border-[var(--glass-border)] pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Header />
        <ReviewBadge status={status} />
      </div>

      {status === 'none' && !canEdit && (
        <p className="text-sm text-fg-subtle">No review requested.</p>
      )}

      {status === 'none' && canEdit && (
        <div className="flex flex-wrap items-end gap-2">
          <GlassSelect
            label="Choose a reviewer"
            className="min-w-[12rem] flex-1"
            value={reviewerId}
            onChange={setReviewerId}
            options={[
              { value: '', label: 'Choose a reviewer…' },
              ...members.map((member) => ({
                value: member.userId,
                label: member.displayName ?? 'Member',
              })),
            ]}
          />
          <GradientButton
            size="sm"
            leftIcon={<UserCheck size={15} />}
            disabled={!reviewerId || update.isPending}
            onClick={() =>
              setReview({
                id: card.id,
                review_status: 'in_review',
                review_assignee_id: reviewerId,
                reviewed_by: null,
                reviewed_at: null,
              })
            }
          >
            Request
          </GradientButton>
        </div>
      )}

      {status === 'in_review' && (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-fg-muted">
            Awaiting review from{' '}
            <span className="font-medium text-fg">{nameOf(card.review_assignee_id)}</span>.
          </p>
          {canEdit && (
            <div className="flex flex-wrap gap-2">
              <GradientButton
                size="sm"
                accent="lagoon"
                leftIcon={<Check size={15} />}
                disabled={update.isPending}
                onClick={() =>
                  setReview({
                    id: card.id,
                    review_status: 'approved',
                    review_assignee_id: card.review_assignee_id,
                    reviewed_by: user?.id ?? null,
                    reviewed_at: new Date().toISOString(),
                  })
                }
              >
                Approve
              </GradientButton>
              <GradientButton
                size="sm"
                accent="ember"
                variant="secondary"
                leftIcon={<RotateCcw size={15} />}
                disabled={update.isPending}
                onClick={() =>
                  setReview({
                    id: card.id,
                    review_status: 'changes_requested',
                    review_assignee_id: card.review_assignee_id,
                    reviewed_by: user?.id ?? null,
                    reviewed_at: new Date().toISOString(),
                  })
                }
              >
                Request changes
              </GradientButton>
              <CancelButton onClick={clearReview} busy={update.isPending} />
            </div>
          )}
        </div>
      )}

      {(status === 'approved' || status === 'changes_requested') && (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-fg-muted">
            <span className="font-medium text-fg">{nameOf(card.reviewed_by)}</span>{' '}
            {status === 'approved' ? 'approved this' : 'requested changes'}
            {card.reviewed_at ? ` ${relativeTime(card.reviewed_at)}` : ''}.
          </p>
          {canEdit && (
            <div className="flex flex-wrap gap-2">
              <GradientButton
                size="sm"
                variant="secondary"
                leftIcon={<UserCheck size={15} />}
                disabled={update.isPending}
                onClick={() =>
                  setReview({
                    id: card.id,
                    review_status: 'in_review',
                    review_assignee_id: card.review_assignee_id,
                    reviewed_by: null,
                    reviewed_at: null,
                  })
                }
              >
                Re-request review
              </GradientButton>
              <CancelButton onClick={clearReview} busy={update.isPending} />
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function Header() {
  return (
    <h4 className="flex items-center gap-2 text-sm font-semibold text-fg">
      <UserCheck size={16} aria-hidden /> Review
    </h4>
  );
}

function CancelButton({ onClick, busy }: { onClick: () => void; busy: boolean }) {
  return (
    <GradientButton size="sm" variant="ghost" leftIcon={<X size={15} />} disabled={busy} onClick={onClick}>
      Clear review
    </GradientButton>
  );
}

function relativeTime(iso: string): string {
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true });
  } catch {
    return '';
  }
}
