import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { track } from '@/lib/analytics';
import { mustUseStoreBilling } from '@/lib/native/platform';
import {
  PurchaseCancelled,
  purchaseStorePlan,
  restoreStorePurchases,
  storeSubscriptionsUrl,
} from '@/lib/native/storeBilling';
import type { BillingInterval, PricedPlanId } from '@/lib/plans';
import { createCheckoutUrl, createPortalUrl, requestPlanChange } from './api';

/** Inside the iOS/Android apps every purchase goes through Apple/Google billing
 * (store rules) via RevenueCat — never Dodo. The plan itself only changes when
 * the verified RevenueCat webhook fires; we just refetch the profile after. */
const STORE_PURCHASE_FAILED = 'Could not complete the purchase. Please try again.';

type Pending = 'checkout' | 'portal' | 'change' | 'restore' | null;
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
  const [restoreNotice, setRestoreNotice] = useState<string | null>(null);
  const queryClient = useQueryClient();

  /** Store apps only: re-attach purchases made on another device or before a
   * reinstall (Apple requires a visible way to do this). */
  async function restore(): Promise<void> {
    setPending('restore');
    setError(null);
    setRestoreNotice(null);
    try {
      await restoreStorePurchases();
      setRestoreNotice('Purchases restored. If your plan still shows Free, it will update in a few seconds.');
      for (const delayMs of [1500, 4000, 8000]) {
        setTimeout(() => void queryClient.invalidateQueries({ queryKey: ['profile'] }), delayMs);
      }
    } catch {
      setError('Could not restore purchases. Please try again.');
    } finally {
      setPending(null);
    }
  }

  async function storePurchase(interval: BillingInterval, plan: CheckoutPlan): Promise<void> {
    setPending('checkout');
    setError(null);
    try {
      await purchaseStorePlan(plan, interval);
      setChanged(true);
      for (const delayMs of [1500, 4000, 8000]) {
        setTimeout(() => void queryClient.invalidateQueries({ queryKey: ['profile'] }), delayMs);
      }
    } catch (err) {
      if (!(err instanceof PurchaseCancelled)) setError(STORE_PURCHASE_FAILED);
    } finally {
      setPending(null);
    }
  }

  async function go(
    kind: 'checkout' | 'portal',
    interval: BillingInterval,
    plan: CheckoutPlan,
  ): Promise<void> {
    if (mustUseStoreBilling()) {
      if (kind === 'portal') {
        window.open(storeSubscriptionsUrl(), '_blank', 'noopener');
        return;
      }
      await storePurchase(interval, plan);
      return;
    }
    setPending(kind);
    setError(null);
    if (kind === 'checkout') {
      // "Started" = the user committed to checkout (clicked Upgrade), not just
      // that the Dodo session was successfully created — a failed
      // createCheckoutUrl call is still a real, countable drop-off point.
      track('checkout_started', { plan, interval });
    }
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
    if (mustUseStoreBilling()) {
      await storePurchase(interval, plan);
      return;
    }
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
    restore: () => void restore(),
    restoreNotice,
    pending,
    error,
    changed,
  };
}
