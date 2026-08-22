import { BarChart3, Lock, TrendingUp } from 'lucide-react';
import { GlassPanel } from '@/components/glass/GlassPanel';
import { Spinner } from '@/components/feedback/Spinner';
import { Reveal } from '@/components/motion/Reveal';
import { useAuth } from '@/hooks/useAuth';
import { isAdminUser } from '@/lib/admin';
import type { BreakdownRow, FunnelStage } from './api';
import { useAnalyticsBreakdown, useAnalyticsFunnel } from './useAnalytics';

/** Human-readable labels for the funnel's event names, in stage order. Keep in
 *  sync with the `stages` values list in admin_analytics_funnel() — this only
 *  relabels what the RPC returns, it doesn't change what's queried. */
const FUNNEL_LABELS: Record<string, string> = {
  landing_page_viewed: 'Visited the landing page',
  signup_started: 'Started signing up',
  signup_completed: 'Finished signing up',
  first_board_created: 'Created their first board',
  checkout_started: 'Started checkout',
  checkout_completed: 'Became a paying subscriber',
};

/**
 * The admin analytics dashboard: the core acquisition funnel, plus two
 * breakdowns — `upgrade_prompt_shown` by `limit` is the property
 * reports/ANALYTICS.md itself calls "the single most useful property," and
 * `install_prompt_shown` by `platform` is the other funnel ANALYTICS.md tracks
 * in real depth. Deliberately not a general BI tool — matches the Simplicity
 * Guardrail call already made for analytics_events itself (a thin funnel
 * layer, not a platform).
 *
 * Route-gated in App.tsx and hidden from the sidebar for non-admins
 * (navItems.ts's `adminOnly`), but also self-gates with `isAdminUser` here —
 * same defense-in-depth as FeedbackInbox. The real gate is `is_admin()` inside
 * both RPC functions: RLS denies analytics_events to every client role
 * regardless of what this component does.
 */
export function AnalyticsDashboard() {
  const { user } = useAuth();

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
    <Reveal className="mx-auto w-full max-w-3xl">
      <header className="flex items-center gap-3 pb-6 pt-2">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[linear-gradient(135deg,var(--accent-from),var(--accent-to))] text-[var(--accent-fg)] shadow-[0_12px_26px_-12px_var(--accent-glow)]">
          <BarChart3 size={22} />
        </span>
        <div>
          <h1 className="gradient-text font-display text-headline font-bold leading-none">
            Analytics
          </h1>
          <p className="mt-1 text-sm text-fg-muted">
            Where people drop off, from landing on the site to paying.
          </p>
        </div>
      </header>

      <FunnelSection />

      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        <BreakdownSection
          title="Why people see an upgrade prompt"
          eventName="upgrade_prompt_shown"
          propertyKey="limit"
        />
        <BreakdownSection
          title="Install prompts by platform"
          eventName="install_prompt_shown"
          propertyKey="platform"
        />
      </div>
    </Reveal>
  );
}

/** Renders whatever a thrown Error's `.message` is, falling back to a generic
 *  line for a non-Error rejection. Surfacing the real message here — instead
 *  of a fixed "couldn't load" string — is deliberate: it's what would have
 *  told us in five seconds, from the page itself, exactly what's wrong. */
function ErrorDetail({ error, fallback }: { error: unknown; fallback: string }) {
  const message = error instanceof Error ? error.message : fallback;
  return <p className="break-words text-sm text-fg-muted">{message}</p>;
}

function FunnelSection() {
  const { data, isLoading, isError, error } = useAnalyticsFunnel();

  return (
    <GlassPanel className="p-6 sm:p-7">
      <div className="mb-5 flex items-center gap-2">
        <TrendingUp size={17} className="text-fg-subtle" />
        <h2 className="text-sm font-semibold text-fg">The core funnel</h2>
      </div>

      {isLoading ? (
        <div className="grid place-items-center py-16">
          <Spinner size={28} />
        </div>
      ) : isError ? (
        <ErrorDetail error={error} fallback="Couldn't load the funnel. Try again shortly." />
      ) : !data || data.length === 0 ? (
        <p className="text-sm text-fg-muted">No funnel events recorded yet.</p>
      ) : (
        <FunnelBars stages={data} />
      )}
    </GlassPanel>
  );
}

function FunnelBars({ stages }: { stages: FunnelStage[] }) {
  const top = stages[0]?.countAllTime || 1;
  return (
    <ul className="flex flex-col gap-4">
      {stages.map((s, i) => {
        const prev = i > 0 ? (stages[i - 1]?.countAllTime ?? null) : null;
        const conversionPct = prev && prev > 0 ? Math.round((s.countAllTime / prev) * 100) : null;
        const widthPct = Math.max(4, Math.round((s.countAllTime / top) * 100));
        return (
          <li key={s.eventName}>
            <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-sm">
              <span className="font-medium text-fg">{FUNNEL_LABELS[s.eventName] ?? s.eventName}</span>
              <span className="whitespace-nowrap font-mono text-xs text-fg-subtle">
                {s.countAllTime.toLocaleString()} all-time · {s.countLast30d.toLocaleString()} / 30d
                {conversionPct !== null ? ` · ${conversionPct}% of prior stage` : ''}
              </span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-[var(--glass-fill)]">
              <div
                className="h-full rounded-full bg-[linear-gradient(90deg,var(--accent-from),var(--accent-to))]"
                style={{ width: `${widthPct}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function BreakdownSection({
  title,
  eventName,
  propertyKey,
}: {
  title: string;
  eventName: string;
  propertyKey: string;
}) {
  const { data, isLoading, isError, error } = useAnalyticsBreakdown(eventName, propertyKey);

  return (
    <GlassPanel className="p-6">
      <h2 className="mb-4 text-sm font-semibold text-fg">{title}</h2>
      {isLoading ? (
        <div className="grid place-items-center py-8">
          <Spinner size={22} />
        </div>
      ) : isError ? (
        <ErrorDetail error={error} fallback="Couldn't load this breakdown." />
      ) : !data || data.length === 0 ? (
        <p className="text-sm text-fg-muted">No data in the last 30 days.</p>
      ) : (
        <BreakdownBars rows={data} />
      )}
    </GlassPanel>
  );
}

function BreakdownBars({ rows }: { rows: BreakdownRow[] }) {
  const top = rows[0]?.count || 1;
  return (
    <ul className="flex flex-col gap-3">
      {rows.map((row) => (
        <li key={row.value}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-xs">
            <span className="font-medium text-fg">{row.value}</span>
            <span className="font-mono text-fg-subtle">{row.count.toLocaleString()}</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--glass-fill)]">
            <div
              className="h-full rounded-full bg-[linear-gradient(90deg,var(--accent-from),var(--accent-to))]"
              style={{ width: `${Math.max(4, Math.round((row.count / top) * 100))}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
