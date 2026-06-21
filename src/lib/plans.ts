/**
 * Plan model — the single source of truth for what Free vs Pro offer.
 *
 * Limits are presentational here AND enforced server-side (triggers on
 * `projects` and `project_members` re-check them), so the UI and the database
 * can never disagree. Stripe is the source of truth for *who* is on which plan —
 * the app only ever reads `profiles.plan`, set by the verified webhook. Prices
 * here are display-only; the real charge comes from the matching Stripe Price
 * objects (monthly → STRIPE_PRICE_PRO, yearly → STRIPE_PRICE_PRO_ANNUAL). See
 * plan.md → Billing.
 */

export type PlanId = 'free' | 'pro';

/** How a paid plan is billed. Maps to a distinct Stripe Price per interval. */
export type BillingInterval = 'month' | 'year';

export interface Plan {
  id: PlanId;
  name: string;
  /** Monthly price in USD. 0 for free. Display only — Stripe holds real prices. */
  priceMonthly: number;
  /**
   * Total price in USD when billed yearly (already discounted). `null` when the
   * plan has no annual option (Free). Display only — create a matching yearly
   * Stripe Price and wire it as STRIPE_PRICE_PRO_ANNUAL.
   */
  priceAnnual: number | null;
  tagline: string;
  /** Max project boards a user may OWN. `null` = unlimited. Mirrored by a DB trigger. */
  projectLimit: number | null;
  /** Max members per board, including the owner. `null` = unlimited. Mirrored by a DB trigger. */
  memberLimit: number | null;
  /** Headline benefits, shown on the pricing card. */
  features: string[];
}

/** Free-tier caps. Keep in sync with the `projects` / `project_members` triggers. */
export const FREE_PROJECT_LIMIT = 10;
export const FREE_MEMBER_LIMIT = 3;

/** Discount applied to annual billing vs. paying monthly for a full year. */
export const PRO_ANNUAL_DISCOUNT_PCT = 5;

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: 'free',
    name: 'Free',
    priceMonthly: 0,
    priceAnnual: null,
    tagline: 'Everything you need to plan solo or with a small team.',
    projectLimit: FREE_PROJECT_LIMIT,
    memberLimit: FREE_MEMBER_LIMIT,
    features: [
      `Up to ${FREE_PROJECT_LIMIT} project boards`,
      `Collaborate with up to ${FREE_MEMBER_LIMIT} people per board`,
      'Unlimited cards, columns & checklists',
      'Calendar view & daily to-do planner',
      'Browser due-date reminders',
      'Installable app, light & dark themes',
    ],
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    priceMonthly: 5.99,
    // 5.99 × 12 = 71.88, less PRO_ANNUAL_DISCOUNT_PCT (5%) ≈ 68.29 (≈ $5.69/mo).
    priceAnnual: 68.29,
    tagline: 'For power users and growing teams who need room to scale.',
    projectLimit: null,
    memberLimit: null,
    features: [
      'Unlimited project boards',
      'Unlimited collaborators per board',
      'Everything in Free',
      'Email due-date reminders',
      'Priority support',
    ],
  },
};

export const PLAN_ORDER: PlanId[] = ['free', 'pro'];

/** The owned-board cap for a plan (`null` = unlimited). */
export function planProjectLimit(plan: PlanId): number | null {
  return PLANS[plan].projectLimit;
}

/** True when a user on `plan` who owns `ownedCount` boards can't create more. */
export function isAtProjectLimit(plan: PlanId, ownedCount: number): boolean {
  const limit = PLANS[plan].projectLimit;
  return limit !== null && ownedCount >= limit;
}

/** True when a board owned by `plan` with `memberCount` members can't add more. */
export function isAtMemberLimit(plan: PlanId, memberCount: number): boolean {
  const limit = PLANS[plan].memberLimit;
  return limit !== null && memberCount >= limit;
}

/** Price for a plan at a given billing interval (falls back to 12× monthly). */
export function planPrice(plan: PlanId, interval: BillingInterval): number {
  const p = PLANS[plan];
  if (interval === 'year') return p.priceAnnual ?? p.priceMonthly * 12;
  return p.priceMonthly;
}

/** Effective per-month cost when billed annually (`null` if no annual price). */
export function annualPerMonth(plan: PlanId): number | null {
  const p = PLANS[plan];
  return p.priceAnnual === null ? null : Number((p.priceAnnual / 12).toFixed(2));
}

/** Dollars saved per year by paying annually vs. monthly (`null` if no annual). */
export function annualSavings(plan: PlanId): number | null {
  const p = PLANS[plan];
  return p.priceAnnual === null ? null : Number((p.priceMonthly * 12 - p.priceAnnual).toFixed(2));
}
