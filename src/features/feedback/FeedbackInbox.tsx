import { format, parseISO } from 'date-fns';
import { Inbox, Lightbulb, Lock, MessageSquareHeart } from 'lucide-react';
import { GlassPanel } from '@/components/glass/GlassPanel';
import { Badge } from '@/components/Badge';
import { Spinner } from '@/components/feedback/Spinner';
import { Reveal } from '@/components/motion/Reveal';
import { useAuth } from '@/hooks/useAuth';
import { isAdminUser } from '@/lib/admin';
import type { Feedback } from '@/types/database';
import { useAllFeedback } from './useFeedback';

/**
 * The admin's feedback inbox: every submission, newest first. Intended to be
 * route-gated, but it also guards with `isAdminUser` so it can never render its
 * contents for a non-admin (and RLS would deny the data anyway, plan.md §6).
 */
export function FeedbackInbox() {
  const { user } = useAuth();
  const { data, isLoading, isError } = useAllFeedback();

  if (!isAdminUser(user)) {
    return (
      <Reveal className="mx-auto w-full max-w-2xl">
        <GlassPanel className="flex flex-col items-center gap-3 p-10 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[var(--glass-fill)] text-fg-subtle">
            <Lock size={22} />
          </span>
          <p className="text-fg-muted">This page is for the Aurora admin only.</p>
        </GlassPanel>
      </Reveal>
    );
  }

  return (
    <Reveal className="mx-auto w-full max-w-2xl">
      <header className="flex items-center gap-3 pb-6 pt-2">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[linear-gradient(135deg,var(--accent-from),var(--accent-to))] text-white shadow-[0_12px_26px_-12px_var(--accent-glow)]">
          <Inbox size={22} />
        </span>
        <div>
          <h1 className="gradient-text font-display text-headline font-bold leading-none">
            Feedback inbox
          </h1>
          <p className="mt-1 text-sm text-fg-muted">
            What your users love, miss, and want next.
          </p>
        </div>
      </header>

      {isLoading ? (
        <div className="grid place-items-center py-24">
          <Spinner size={32} />
        </div>
      ) : isError ? (
        <GlassPanel className="p-6 text-center text-fg-muted">
          Couldn&apos;t load feedback. Check your connection and try again.
        </GlassPanel>
      ) : !data || data.length === 0 ? (
        <GlassPanel className="flex flex-col items-center gap-3 p-10 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[var(--glass-fill)] text-fg-subtle">
            <Inbox size={22} />
          </span>
          <p className="text-fg-muted">No feedback yet. The first note will land here.</p>
        </GlassPanel>
      ) : (
        <ul className="flex flex-col gap-3">
          {data.map((item) => (
            <li key={item.id}>
              <FeedbackRow item={item} />
            </li>
          ))}
        </ul>
      )}
    </Reveal>
  );
}

function FeedbackRow({ item }: { item: Feedback }) {
  const isFeature = item.kind === 'feature';
  return (
    <GlassPanel className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Badge tone={isFeature ? 'info' : 'accent'}>
          {isFeature ? <Lightbulb size={13} /> : <MessageSquareHeart size={13} />}
          {isFeature ? 'Feature idea' : 'Feedback'}
        </Badge>
        <time
          dateTime={item.created_at}
          className="text-xs text-fg-subtle"
          title={format(parseISO(item.created_at), 'PPpp')}
        >
          {format(parseISO(item.created_at), 'MMM d, yyyy')}
        </time>
      </div>
      <p className="mt-3 whitespace-pre-wrap break-words text-[0.95rem] leading-relaxed text-fg">
        {item.message}
      </p>
      <p className="mt-3 font-mono text-xs text-fg-subtle">From user {item.user_id}</p>
    </GlassPanel>
  );
}
