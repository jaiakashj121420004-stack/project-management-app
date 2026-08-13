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
  ENTERPRISE_CONTACT_EMAIL,
  ENTERPRISE_DISPLAY,
  PLANS,
  TEAM_MEMBER_LIMIT,
  annualPerMonth,
  isProOrAbove,
  planPrice,
  PRO_ANNUAL_DISCOUNT_PCT,
  type BillingInterval,
  type PlanId,
  type PricedPlanId,
} from '@/lib/plans';
import { PlanBadge } from './PlanBadge';
import { IntervalToggle } from './IntervalToggle';
import { useBilling } from './useBilling';

/** Account → Billing: shows the current plan and the upgrade / manage actions. */
export function BillingPage() {
  const { data: profile, isLoading } = useProfile();
  const { startCheckout, openPortal, changePlan, pending, error, changed } = useBilling();
  const [params, setParams] = useSearchParams();
  const queryClient = useQueryClient();

  const status = params.get('status');

  // Returning from a successful checkout, the webhook may take a moment to flip
  // the plan — refetch the profile so the page reflects the new plan as soon as
  // it does.
  useEffect(() => {
    if (status === 'success') {
      void queryClient.invalidateQueries({ queryKey: ['profile'] });
    }
  }, [status, queryClient]);

  const plan: PlanId = profile?.plan ?? 'free';
  // 'enterprise' has no self-serve `PLANS` entry — fall back to its display copy.
  const current = plan === 'enterprise' ? ENTERPRISE_DISPLAY : PLANS[plan];
  const currentPriceMonthly = plan === 'enterprise' ? null : PLANS[plan].priceMonthly;
  const isPaid = isProOrAbove(plan);

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
          You&apos;re upgraded — thank you! If your plan still shows Free, it&apos;ll update within a
          few seconds.
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
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[linear-gradient(135deg,var(--accent-from),var(--accent-to))] text-[var(--accent-fg)] shadow-[0_10px_22px_-12px_var(--accent-glow)]">
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
              {currentPriceMonthly !== null && (
                <p className="text-fg-muted">
                  <span className="font-display text-title font-bold text-fg">
                    ${currentPriceMonthly}
                  </span>
                  {' / month'}
                </p>
              )}
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
              {isPaid ? (
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
                  onClick={() => startCheckout('month', 'pro')}
                >
                  Upgrade to Pro
                </GradientButton>
              )}
            </div>
            {isPaid && plan !== 'enterprise' && (
              <p className="mt-2 text-xs text-fg-subtle">
                Update your card, download invoices, or cancel in the Dodo Payments portal.
              </p>
            )}
          </>
        )}
      </GlassPanel>

      {!isLoading && plan === 'free' && (
        <PlanUpsell
          availablePlans={['pro', 'team']}
          onUpgrade={startCheckout}
          upgrading={pending === 'checkout'}
        />
      )}
      {/* Pro and Team are already paying, so switching interval (or Pro → Team)
          goes through changePlan — an in-place update to their existing Dodo
          subscription — never back through Checkout, which would create a
          second, parallel subscription and double-bill them. */}
      {!isLoading && plan === 'pro' && (
        <PlanUpsell
          availablePlans={['pro', 'team']}
          onUpgrade={changePlan}
          upgrading={pending === 'change'}
          changed={changed}
        />
      )}
      {!isLoading && plan === 'team' && (
        <>
          <PlanUpsell
            availablePlans={['team']}
            onUpgrade={changePlan}
            upgrading={pending === 'change'}
            changed={changed}
          />
          <GlassPanel className="mt-6 flex flex-col gap-1 p-6 text-sm sm:p-8">
            <p className="font-medium text-fg">Need more than {TEAM_MEMBER_LIMIT} people on one board?</p>
            <p className="text-fg-muted">
              <a
                href={`mailto:${ENTERPRISE_CONTACT_EMAIL}?subject=Aurora%20Enterprise`}
                className="font-semibold text-[var(--accent-from)] hover:underline"
              >
                Contact us
              </a>{' '}
              about an Enterprise plan built for your organization.
            </p>
          </GlassPanel>
        </>
      )}
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

/** A compact "why upgrade" card shown under the current plan, with a Monthly /
 *  Annual switch (annual saves PRO_ANNUAL_DISCOUNT_PCT %). When `availablePlans`
 *  has more than one entry (a free user, who could go straight to either Pro or
 *  Team) it also shows a small plan switcher; a Pro user only ever sees Team. */
function PlanUpsell({
  availablePlans,
  onUpgrade,
  upgrading,
  changed = false,
}: {
  availablePlans: PricedPlanId[];
  onUpgrade: (interval: BillingInterval, plan: Exclude<PricedPlanId, 'free'>) => void;
  upgrading: boolean;
  /** True right after an in-place plan change (changePlan) was accepted — shows
   *  a short confirmation instead of assuming a redirect is about to happen. */
  changed?: boolean;
}) {
  const [interval, setInterval] = useState<BillingInterval>('month');
  const [selected, setSelected] = useState<Exclude<PricedPlanId, 'free'>>(
    availablePlans[0] as Exclude<PricedPlanId, 'free'>,
  );
  const target = PLANS[selected];
  const annual = interval === 'year';
  const perMonth = annual ? (annualPerMonth(selected) ?? target.priceMonthly) : target.priceMonthly;

  return (
    <GlassPanel className="mt-6 p-6 sm:p-8">
      <div className="flex items-center gap-2">
        <Sparkles size={18} className="text-[var(--accent-from)]" />
        <h2 className="font-display text-title font-semibold text-fg">Go {target.name}</h2>
      </div>
      <p className="mt-1 text-sm text-fg-muted">{target.tagline}</p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {availablePlans.length > 1 && (
          <div className="glass inline-flex rounded-2xl p-1" role="group" aria-label="Plan">
            {availablePlans.map((id) => (
              <button
                key={id}
                type="button"
                aria-pressed={selected === id}
                onClick={() => setSelected(id as Exclude<PricedPlanId, 'free'>)}
                className={
                  'rounded-xl px-3.5 py-1.5 text-sm font-medium transition-colors ' +
                  (selected === id
                    ? 'bg-[linear-gradient(135deg,var(--accent-from),var(--accent-to))] text-[var(--accent-fg)] shadow-[0_8px_18px_-10px_var(--accent-glow)]'
                    : 'text-fg-muted hover:text-fg')
                }
              >
                {PLANS[id].name}
              </button>
            ))}
          </div>
        )}
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
          ${planPrice(selected, 'year').toFixed(2)} billed yearly — save {PRO_ANNUAL_DISCOUNT_PCT}%
        </p>
      )}

      <ul className="mt-4 grid gap-2.5 sm:grid-cols-2">
        {target.features.map((feature) => (
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
          onClick={() => onUpgrade(interval, selected)}
        >
          {annual
            ? `Get ${target.name} — $${planPrice(selected, 'year').toFixed(2)}/yr`
            : `Upgrade for $${target.priceMonthly.toFixed(2)}/mo`}
        </GradientButton>
        {changed && !upgrading && (
          <p className="mt-2.5 text-sm text-success">
            Plan updated — this may take a few seconds to show up above.
          </p>
        )}
      </div>
    </GlassPanel>
  );
}
