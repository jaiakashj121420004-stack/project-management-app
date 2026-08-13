import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { BillingInterval, PricedPlanId } from '@/lib/plans';
import { createCheckoutUrl, createPortalUrl, requestPlanChange } from './api';

type Pending = 'checkout' | 'portal' | 'change' | null;
type CheckoutPlan = Exclude<PricedPlanId, 'free'>;

/**
 * Drives the billing actions. `startCheckout` and `openPortal` end in a
 * full-page redirect to Dodo, so `pending` simply stays set until the browser
 * navigates away (or we reset it on error). `changePlan` is different: the
 * user already has a subscription, so it patches that subscription in place
 * (no redirect) and resolves once Dodo accepts it — the plan value itself
 * only flips once the verified webhook updates the database, so we refetch
 * the profile a couple of times after success to pick that up.
 */
export function useBilling() {
  const [pending, setPending] = useState<Pending>(null);
  const [error, setError] = useState<string | null>(null);
  const [changed, setChanged] = useState(false);
  const queryClient = useQueryClient();

  async function go(
    kind: 'checkout' | 'portal',
    interval: BillingInterval,
    plan: CheckoutPlan,
  ): Promise<void> {
    setPending(kind);
    setError(null);
    try {
      const url =
        kind === 'checkout' ? await createCheckoutUrl(interval, plan) : await createPortalUrl();
      window.location.href = url;
    } catch {
      setError(
        kind === 'checkout'
          ? 'Could not start checkout. Please try again.'
          : 'Could not open the billing portal. Please try again.',
      );
      setPending(null);
    }
  }

  async function changePlan(interval: BillingInterval, plan: CheckoutPlan): Promise<void> {
    setPending('change');
    setError(null);
    setChanged(false);
    try {
      await requestPlanChange(interval, plan);
      setChanged(true);
      // The webhook usually lands within a second or two; nudge the profile
      // query a few times so the new plan/price shows up without a manual
      // refresh, without polling forever.
      for (const delayMs of [1500, 4000, 8000]) {
        setTimeout(() => void queryClient.invalidateQueries({ queryKey: ['profile'] }), delayMs);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update your plan. Please try again.');
    } finally {
      setPending(null);
    }
  }

  return {
    /** Begin Dodo Checkout for `plan` (defaults to Pro) at the given interval
     *  (defaults to monthly). Only for users with no existing subscription. */
    startCheckout: (interval: BillingInterval = 'month', plan: CheckoutPlan = 'pro') =>
      void go('checkout', interval, plan),
    openPortal: () => void go('portal', 'month', 'pro'),
    /** Switch an existing subscription's interval or tier in place. */
    changePlan: (interval: BillingInterval, plan: CheckoutPlan) => void changePlan(interval, plan),
    pending,
    error,
    changed,
  };
}
