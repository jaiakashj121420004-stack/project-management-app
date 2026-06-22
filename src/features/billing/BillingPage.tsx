import { useEffect, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Check, CreditCard, Sparkles, X } from 'lucide-react';
import { GlassPanel } from '@/components/glass/GlassPanel';
import { GradientButton } from '@/components/buttons/GradientButton';
import { Reveal } from '@/components/motion/Reveal';
import { Spinner } from '@/components/feedback/Spinner';
import { useProfile } from '@/features/auth/useProfile';
import {
  PLANS,
  annualPerMonth,
  planPrice,
  PRO_ANNUAL_DISCOUNT_PCT,
  type BillingInterval,
  type PlanId,
} from '@/lib/plans';
import { PlanBadge } from './PlanBadge';
import { IntervalToggle } from './IntervalToggle';
import { useBilling } from './useBilling';

/** Account → Billing: shows the current plan and the upgrade / manage actions. */
export function BillingPage() {
  const { data: profile, isLoading } = useProfile();
  const { startCheckout, openPortal, pending, error } = useBilling();
  const [params, setParams] = useSearchParams();
  const queryClient = useQueryClient();

  const status = params.get('status');

  // Returning from a successful checkout, the webhook may take a moment to flip
  // the plan — refetch the profile so the page reflects Pro as soon as it does.
  useEffect(() => {
    if (status === 'success') {
      void queryClient.invalidateQueries({ queryKey: ['profile'] });
    }
  }, [status, queryClient]);

  const plan: PlanId = profile?.plan ?? 'free';
  const current = PLANS[plan];
  const isPro = plan === 'pro';

  function dismissBanner() {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('status');
        return next;
      },
      { replace: true },
    );
  }

  return (
    <Reveal className="mx-auto w-full max-w-2xl">
      <header className="pb-6 pt-2">
        <h1 className="gradient-text font-display text-headline font-bold">Billing</h1>
        <p className="mt-2 text-fg-muted">Manage your plan and payment details.</p>
      </header>

      {status === 'success' && (
        <Banner tone="success" onDismiss={dismissBanner}>
          You&apos;re on Pro — thank you! If your plan still shows Free, it&apos;ll update within a few
          seconds.
        </Banner>
      )}
      {status === 'cancelled' && (
        <Banner tone="muted" onDismiss={dismissBanner}>
          Checkout was cancelled. You can upgrade whenever you&apos;re ready.
        </Banner>
      )}

      <GlassPanel strong glow className="p-6 sm:p-8">
        {isLoading ? (
          <div className="grid place-items-center py-10">
            <Spinner size={32} />
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[linear-gradient(135deg,var(--accent-from),var(--accent-to))] text-white shadow-[0_10px_22px_-12px_var(--accent-glow)]">
                  <CreditCard size={20} />
                </span>
                <div>
                  <p className="text-sm text-fg-muted">Current plan</p>
                  <p className="flex items-center gap-2 font-display text-lg font-semibold text-fg">
                    {current.name}
                    <PlanBadge plan={plan} />
                  </p>
                </div>
              </div>
              <p className="text-fg-muted">
                <span className="font-display text-title font-bold text-fg">${current.priceMonthly}</span>
                {' / month'}
              </p>
            </div>

            <p className="mt-4 text-sm text-fg-muted">{current.tagline}</p>

            <ul className="mt-5 grid gap-2.5 sm:grid-cols-2">
              {current.features.map((feature) => (
                <li key={feature} className="flex items-start gap-2 text-sm text-fg">
                  <Check size={16} className="mt-0.5 shrink-0 text-[var(--accent-from)]" />
                  {feature}
                </li>
              ))}
            </ul>

            {error && (
              <p className="mt-5 rounded-2xl border border-danger/30 bg-danger/10 px-3.5 py-2.5 text-sm text-danger">
                {error}
              </p>
            )}

            <div className="mt-6 flex flex-wrap gap-3">
              {isPro ? (
                <GradientButton
                  variant="secondary"
                  leftIcon={<CreditCard size={17} />}
                  isLoading={pending === 'portal'}
                  onClick={openPortal}
                >
                  Manage billing
                </GradientButton>
              ) : (
                <GradientButton
                  leftIcon={<Sparkles size={17} />}
                  isLoading={pending === 'checkout'}
                  onClick={() => startCheckout('month')}
                >
                  Upgrade to Pro
                </GradientButton>
              )}
            </div>
            {isPro && (
              <p className="mt-2 text-xs text-fg-subtle">
                Update your card, download invoices, or cancel in the Dodo Payments portal.
              </p>
            )}
          </>
        )}
      </GlassPanel>

      {!isLoading && !isPro && <ProUpsell onUpgrade={startCheckout} upgrading={pending === 'checkout'} />}
    </Reveal>
  );
}

function Banner({
  tone,
  onDismiss,
  children,
}: {
  tone: 'success' | 'muted';
  onDismiss: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className={
        'mb-5 flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm ' +
        (tone === 'success'
          ? 'border-success/30 bg-success/10 text-success'
          : 'border-[var(--glass-border)] bg-[var(--glass-fill)] text-fg-muted')
      }
    >
      <span className="flex-1">{children}</span>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="shrink-0 rounded-lg p-0.5 opacity-70 transition-opacity hover:opacity-100"
      >
        <X size={16} />
      </button>
    </div>
  );
}

/** A compact "why go Pro" card shown to free users under their current plan,
 *  with a Monthly / Annual switch (annual saves PRO_ANNUAL_DISCOUNT_PCT %). */
function ProUpsell({
  onUpgrade,
  upgrading,
}: {
  onUpgrade: (interval: BillingInterval) => void;
  upgrading: boolean;
}) {
  const [interval, setInterval] = useState<BillingInterval>('month');
  const pro = PLANS.pro;
  const annual = interval === 'year';
  const perMonth = annual ? (annualPerMonth('pro') ?? pro.priceMonthly) : pro.priceMonthly;

  return (
    <GlassPanel className="mt-6 p-6 sm:p-8">
      <div className="flex items-center gap-2">
        <Sparkles size={18} className="text-[var(--accent-from)]" />
        <h2 className="font-display text-title font-semibold text-fg">Go Pro</h2>
      </div>
      <p className="mt-1 text-sm text-fg-muted">{pro.tagline}</p>

      <div className="mt-4">
        <IntervalToggle value={interval} onChange={setInterval} />
      </div>

      <div className="mt-4 flex items-baseline gap-1.5">
        <span className="gradient-text font-display text-title font-bold">
          ${perMonth.toFixed(2)}
        </span>
        <span className="text-sm text-fg-muted">/ month</span>
      </div>
      {annual && (
        <p className="mt-1 text-sm text-fg-muted">
          ${planPrice('pro', 'year').toFixed(2)} billed yearly — save {PRO_ANNUAL_DISCOUNT_PCT}%
        </p>
      )}

      <ul className="mt-4 grid gap-2.5 sm:grid-cols-2">
        {pro.features.map((feature) => (
          <li key={feature} className="flex items-start gap-2 text-sm text-fg">
            <Check size={16} className="mt-0.5 shrink-0 text-[var(--accent-from)]" />
            {feature}
          </li>
        ))}
      </ul>
      <div className="mt-6">
        <GradientButton
          leftIcon={<Sparkles size={17} />}
          isLoading={upgrading}
          onClick={() => onUpgrade(interval)}
        >
          {annual
            ? `Get Pro — $${planPrice('pro', 'year').toFixed(2)}/yr`
            : `Upgrade for $${pro.priceMonthly.toFixed(2)}/mo`}
        </GradientButton>
      </div>
    </GlassPanel>
  );
}
