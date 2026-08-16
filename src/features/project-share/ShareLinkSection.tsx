import { useState } from 'react';
import { Copy, Globe2 } from 'lucide-react';
import { GradientButton } from '@/components/buttons/GradientButton';
import { Tooltip } from '@/components/Tooltip';
import { Spinner } from '@/components/feedback/Spinner';
import { shareUrlForToken } from './api';
import { useCreateProjectShareLink, useProjectShareLink, useRevokeProjectShareLink } from './useProjectShare';

/**
 * Owner-only "public read-only link" section, embedded in MembersPanel next to
 * the invite form — same copy/rotate/turn-off visual language as
 * SettingsPage.tsx's `CalendarFeedSection` (the calendar subscribe link),
 * since both are "one plain URL, no login, revocable" affordances. Unlike
 * calendar sync, there's no "rotate" here — turning it off and creating a
 * fresh one covers that (see the migration's design note on why).
 */
export function ShareLinkSection({ projectId }: { projectId: string }) {
  const { data: link, isLoading } = useProjectShareLink(projectId);
  const create = useCreateProjectShareLink(projectId);
  const revoke = useRevokeProjectShareLink(projectId);
  const [copied, setCopied] = useState(false);

  async function handleCopy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API can be denied/unavailable — the URL is still selectable
      // text in the field below, so nothing is actually blocked.
    }
  }

  return (
    <section className="flex flex-col gap-3 border-t border-[var(--glass-border)] pt-5">
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-fg-muted">
          Public read-only link
        </h3>
        <p className="mt-1 text-xs text-fg-subtle">
          Anyone with this link can view the board — no Aurora account needed. They can&apos;t edit
          anything, see comments, or see who&apos;s on the team.
        </p>
      </div>

      {isLoading ? (
        <div className="py-2">
          <Spinner size={18} />
        </div>
      ) : !link ? (
        <GradientButton
          variant="secondary"
          size="sm"
          leftIcon={<Globe2 size={15} />}
          onClick={() => create.mutate()}
          isLoading={create.isPending}
          className="self-start"
        >
          Create read-only link
        </GradientButton>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              type="text"
              readOnly
              value={shareUrlForToken(link.token)}
              onFocus={(e) => e.currentTarget.select()}
              aria-label="Public read-only board link"
              className="h-10 flex-1 rounded-lg border border-[var(--glass-border)] bg-[var(--field-bg)] px-2.5 text-sm text-fg-muted focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--accent-from)]"
            />
            <Tooltip label="Copy link">
              <button
                type="button"
                onClick={() => void handleCopy(shareUrlForToken(link.token))}
                className="btn-3d flex h-10 shrink-0 items-center gap-1.5 rounded-lg bg-[linear-gradient(110deg,var(--accent-from),var(--accent-to))] px-3.5 text-sm font-semibold text-[var(--accent-fg)]"
              >
                <Copy size={15} /> {copied ? 'Copied!' : 'Copy'}
              </button>
            </Tooltip>
          </div>
          <button
            type="button"
            onClick={() => revoke.mutate()}
            disabled={revoke.isPending}
            className="self-start text-xs font-medium text-fg-muted hover:text-danger disabled:opacity-50"
          >
            Turn off
          </button>
        </div>
      )}
    </section>
  );
}
