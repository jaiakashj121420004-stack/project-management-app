/**
 * storeBilling.ts — Apple / Google in-app subscriptions via RevenueCat.
 *
 * Only ever runs inside the iOS / Android shells (`mustUseStoreBilling()`).
 * The app NEVER grants a plan itself: a purchase reaches RevenueCat, RevenueCat
 * calls the `revenuecat-webhook` Edge Function, which writes `entitlements` and
 * recomputes `profiles.plan`. We just refetch the profile afterwards.
 *
 * RevenueCat setup (see store/STORE-SETUP.md): two offerings, `pro` and `team`,
 * each with a `$rc_monthly` and a `$rc_annual` package.
 */
import type { BillingInterval, PricedPlanId } from '@/lib/plans';
import { appPlatform } from './platform';

type PaidPlan = Exclude<PricedPlanId, 'free'>;

const API_KEYS = {
  ios: import.meta.env.VITE_RC_IOS_KEY as string | undefined,
  android: import.meta.env.VITE_RC_ANDROID_KEY as string | undefined,
};

const PACKAGE_ID: Record<BillingInterval, string> = {
  month: '$rc_monthly',
  year: '$rc_annual',
};

let configuredFor: string | null = null;

async function purchases() {
  return (await import('@revenuecat/purchases-capacitor')).Purchases;
}

/** Identify the RevenueCat customer as the Supabase user id (called on sign-in). */
export async function initStoreBilling(userId: string): Promise<void> {
  const platform = appPlatform();
  const apiKey = platform === 'ios' ? API_KEYS.ios : platform === 'android' ? API_KEYS.android : undefined;
  if (!apiKey || configuredFor === userId) return;
  const Purchases = await purchases();
  if (configuredFor === null) {
    await Purchases.configure({ apiKey, appUserID: userId });
  } else {
    await Purchases.logIn({ appUserID: userId });
  }
  configuredFor = userId;
}

export async function resetStoreBilling(): Promise<void> {
  if (configuredFor === null) return;
  configuredFor = null;
  try {
    await (await purchases()).logOut();
  } catch {
    // Already anonymous — nothing to do.
  }
}

export class PurchaseCancelled extends Error {}

/** Show the native Apple / Google purchase sheet for `plan` at `interval`. */
export async function purchaseStorePlan(plan: PaidPlan, interval: BillingInterval): Promise<void> {
  const Purchases = await purchases();
  const offerings = await Purchases.getOfferings();
  const offering = offerings.all[plan];
  const aPackage = offering?.availablePackages.find((p) => p.identifier === PACKAGE_ID[interval]);
  if (!aPackage) throw new Error('This plan is not available in the store yet.');
  try {
    await Purchases.purchasePackage({ aPackage });
  } catch (err) {
    if ((err as { userCancelled?: boolean }).userCancelled) throw new PurchaseCancelled();
    throw err;
  }
}

/** Re-attach purchases made on another device / after reinstall. */
export async function restoreStorePurchases(): Promise<void> {
  await (await purchases()).restorePurchases();
}

/** Manage / cancel: Apple and Google both require this to live in their own UI. */
export function storeSubscriptionsUrl(): string {
  return appPlatform() === 'ios'
    ? 'https://apps.apple.com/account/subscriptions'
    : 'https://play.google.com/store/account/subscriptions';
}
