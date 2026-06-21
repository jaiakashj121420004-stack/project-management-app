import { useState, type FormEvent } from 'react';
import { format, parseISO } from 'date-fns';
import { AlertCircle, PenLine, Quote, Sparkles } from 'lucide-react';
import { GlassPanel } from '@/components/glass/GlassPanel';
import { GradientButton } from '@/components/buttons/GradientButton';
import { TextArea } from '@/components/forms/TextArea';
import { Spinner } from '@/components/feedback/Spinner';
import { Reveal } from '@/components/motion/Reveal';
import { useAuth } from '@/hooks/useAuth';
import { isAdminUser } from '@/lib/admin';
import type { CeoMessage } from '@/types/database';
import { useCeoMessage, useSaveCeoMessage } from './useCeoMessage';

const FOUNDER = 'J. Jai Akash, Founder';
const MAX_LENGTH = 4000;

/**
 * The "Message from the Founder" page. Everyone signed in sees the latest message;
 * the admin gets an inline editor to post or update it (single current message,
 * api.ts). Friendly empty states cover the no-message-yet case for both.
 */
export function CeoMessagePage() {
  const { user } = useAuth();
  const isAdmin = isAdminUser(user);
  const { data: message, isLoading, isError } = useCeoMessage();

  return (
    <Reveal className="mx-auto w-full max-w-2xl">
      <header className="flex items-center gap-3 pb-6 pt-2">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[linear-gradient(135deg,var(--accent-from),var(--accent-to))] text-white shadow-[0_12px_26px_-12px_var(--accent-glow)]">
          <Sparkles size={22} />
        </span>
        <div>
          <h1 className="gradient-text font-display text-headline font-bold leading-none">
            From the Founder
          </h1>
          <p className="mt-1 text-sm text-fg-muted">A note to everyone building with Aurora.</p>
        </div>
      </header>

      {isLoading ? (
        <div className="grid place-items-center py-24">
          <Spinner size={32} />
        </div>
      ) : isError ? (
        <GlassPanel className="p-6 text-center text-fg-muted">
          Couldn&apos;t load the message. Check your connection and try again.
        </GlassPanel>
      ) : message ? (
        <MessageCard message={message} />
      ) : (
        <EmptyState isAdmin={isAdmin} />
      )}

      {isAdmin && <AdminEditor message={message ?? null} />}
    </Reveal>
  );
}

function MessageCard({ message }: { message: CeoMessage }) {
  return (
    <GlassPanel strong glow accent="galaxy" className="relative overflow-hidden p-7 sm:p-9">
      <Quote
        size={64}
        aria-hidden
        className="pointer-events-none absolute -right-2 -top-2 text-[var(--accent-from)] opacity-10"
      />
      <p className="whitespace-pre-wrap break-words font-display text-lg leading-relaxed text-fg sm:text-xl">
        {message.message}
      </p>
      <footer className="mt-6 border-t border-[var(--glass-border)] pt-4">
        <p className="gradient-text font-display text-lg font-semibold">— {FOUNDER}</p>
        <time dateTime={message.updated_at} className="mt-0.5 block text-sm text-fg-subtle">
          {format(parseISO(message.updated_at), 'MMMM d, yyyy')}
        </time>
      </footer>
    </GlassPanel>
  );
}

function EmptyState({ isAdmin }: { isAdmin: boolean }) {
  return (
    <GlassPanel className="flex flex-col items-center gap-3 p-10 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[var(--glass-fill)] text-fg-subtle">
        <PenLine size={22} />
      </span>
      <p className="text-fg-muted">
        {isAdmin
          ? 'Write your first message to your users.'
          : 'No message yet — check back soon for a word from the founder.'}
      </p>
    </GlassPanel>
  );
}

/** Inline composer shown only to the admin (also RLS-gated server-side). */
function AdminEditor({ message }: { message: CeoMessage | null }) {
  const save = useSaveCeoMessage();
  const [draft, setDraft] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const value = draft ?? message?.message ?? '';
  const trimmed = value.trim();

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    setSaved(false);
    if (!trimmed) {
      setFormError('Write a message before saving.');
      return;
    }
    try {
      await save.mutateAsync(trimmed);
      setDraft(null);
      setSaved(true);
    } catch {
      setFormError('Could not save your message. Please try again.');
    }
  }

  return (
    <section className="mt-8">
      <h2 className="px-1 font-display text-title font-semibold text-fg">
        {message ? 'Edit your message' : 'Post your message'}
      </h2>
      <p className="mt-1 px-1 text-sm text-fg-muted">
        Only you can see this editor. Everyone signed in sees the message above.
      </p>
      <GlassPanel strong className="mt-3 p-5 sm:p-6">
        {formError && (
          <div
            role="alert"
            className="mb-4 flex items-start gap-2.5 rounded-2xl border border-danger/30 bg-danger/10 px-3.5 py-3 text-sm text-danger"
          >
            <AlertCircle size={18} className="mt-px shrink-0" />
            <span>{formError}</span>
          </div>
        )}
        {saved && (
          <div
            role="status"
            className="mb-4 rounded-2xl border border-success/30 bg-success/10 px-3.5 py-3 text-sm text-success"
          >
            Your message is live.
          </div>
        )}
        <form onSubmit={(event) => void onSubmit(event)} noValidate className="flex flex-col gap-4">
          <TextArea
            label="Message"
            placeholder="Share what's new, what's coming, or a word of thanks..."
            value={value}
            onChange={(event) => {
              setDraft(event.target.value);
              setSaved(false);
            }}
            maxLength={MAX_LENGTH}
            className="min-h-[160px]"
          />
          <div className="flex justify-end">
            <GradientButton type="submit" isLoading={save.isPending} disabled={!trimmed}>
              {message ? 'Update message' : 'Post message'}
            </GradientButton>
          </div>
        </form>
      </GlassPanel>
    </section>
  );
}
