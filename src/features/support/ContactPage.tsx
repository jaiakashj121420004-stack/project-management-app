import { Mail, MessageSquarePlus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { GlassPanel } from '@/components/glass/GlassPanel';
import { Reveal } from '@/components/motion/Reveal';
import { ENTERPRISE_CONTACT_EMAIL } from '@/lib/plans';

/**
 * Contact Us — reachable from the profile menu. One honest way to reach a
 * one-person team: the real inbox, not a ticket queue or a chatbot. Keeps the
 * same plain, no-hype voice as the rest of the product (see MARKETING.md §19).
 */
export function ContactPage() {
  return (
    <Reveal className="mx-auto w-full max-w-xl">
      <header className="pb-6 pt-2">
        <h1 className="gradient-text font-display text-headline font-bold">Contact us</h1>
        <p className="mt-2 text-fg-muted">
          Aurora is built and run by one person, so this goes straight to me — not a queue.
        </p>
      </header>

      <GlassPanel strong glow className="p-6 sm:p-8">
        <div className="flex items-start gap-4">
          <span
            className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl"
            style={{ background: 'rgba(194,74,64,0.12)', color: 'var(--accent-from, #7A2A26)' }}
          >
            <Mail size={22} />
          </span>
          <div className="min-w-0">
            <p className="font-display text-lg font-semibold text-fg">Email</p>
            <p className="mt-1 text-sm text-fg-muted">
              Bugs, billing questions, feature requests, or just something that felt off — all of
              it comes to the same inbox and I read every one.
            </p>
            <a
              href={`mailto:${ENTERPRISE_CONTACT_EMAIL}`}
              className="mt-4 inline-flex items-center gap-2 rounded-2xl border border-[var(--hairline)] bg-[var(--glass-fill)] px-4 py-2.5 text-sm font-medium text-fg transition-colors hover:bg-[var(--glass-fill-strong)]"
            >
              <Mail size={16} />
              {ENTERPRISE_CONTACT_EMAIL}
            </a>
          </div>
        </div>

        <div className="my-6 h-px bg-[var(--hairline)]" />

        <div className="flex items-start gap-4">
          <span
            className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl"
            style={{ background: 'rgba(194,74,64,0.12)', color: 'var(--accent-from, #7A2A26)' }}
          >
            <MessageSquarePlus size={22} />
          </span>
          <div className="min-w-0">
            <p className="font-display text-lg font-semibold text-fg">In-app feedback</p>
            <p className="mt-1 text-sm text-fg-muted">
              For a quick bug report or idea while you're already in Aurora, the feedback form
              reaches the same place with less typing.
            </p>
            <Link
              to="/feedback"
              className="mt-4 inline-flex items-center gap-2 rounded-2xl border border-[var(--hairline)] bg-[var(--glass-fill)] px-4 py-2.5 text-sm font-medium text-fg transition-colors hover:bg-[var(--glass-fill-strong)]"
            >
              <MessageSquarePlus size={16} />
              Send feedback
            </Link>
          </div>
        </div>
      </GlassPanel>

      <p className="mx-auto mt-6 max-w-md text-center text-sm text-fg-subtle">
        There's no support team yet, so replies won't be instant — but they'll be from someone who
        actually built the thing you're asking about.
      </p>
    </Reveal>
  );
}
