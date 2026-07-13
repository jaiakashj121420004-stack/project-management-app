import { MessageSquareHeart } from 'lucide-react';
import { GlassPanel } from '@/components/glass/GlassPanel';
import { Reveal } from '@/components/motion/Reveal';
import { useAuth } from '@/hooks/useAuth';
import { isAdminUser } from '@/lib/admin';
import { FeedbackForm } from './FeedbackForm';
import { FeedbackInbox } from './FeedbackInbox';

/**
 * The Feedback / Features destination, visible to every signed-in user from the
 * sidebar. Everyone gets the submission form; the admin additionally sees the
 * inbox of all submissions below it (RLS only returns everything to the admin).
 */
export function FeedbackPage() {
  const { user } = useAuth();
  const admin = isAdminUser(user);

  return (
    <Reveal className="mx-auto w-full max-w-2xl">
      <header className="flex items-center gap-3 pb-6 pt-2">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[linear-gradient(135deg,var(--accent-from),var(--accent-to))] text-[var(--accent-fg)] shadow-[0_12px_26px_-12px_var(--accent-glow)]">
          <MessageSquareHeart size={22} />
        </span>
        <div>
          <h1 className="gradient-text font-display text-headline font-bold leading-none">
            Feedback &amp; feature ideas
          </h1>
          <p className="mt-1 text-sm text-fg-muted">
            Tell us what you love, what is missing, or what to build next.
          </p>
        </div>
      </header>

      <GlassPanel className="p-6 sm:p-7">
        <FeedbackForm />
      </GlassPanel>

      {admin && (
        <section className="mt-12">
          <FeedbackInbox />
        </section>
      )}
    </Reveal>
  );
}
