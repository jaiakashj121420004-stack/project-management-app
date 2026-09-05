/**
 * Plan model — the single source of truth for what Free vs Pro offer.
 *
 * Limits are presentational here AND enforced server-side (triggers on
 * `projects` and `project_members` re-check them), so the UI and the database
 * can never disagree. Dodo Payments is the source of truth for *who* is on which
 * plan — the app only ever reads `profiles.plan`, set by the verified webhook.
 * Prices here are display-only (USD; Dodo localizes the currency at checkout);
 * the real charge comes from the matching Dodo products (monthly →
 * DODO_PRODUCT_PRO_MONTHLY, yearly → DODO_PRODUCT_PRO_ANNUAL). See plan.md →
 * Billing.
 *
 * Which capabilities are Pro (and their storage caps) live in `proFeatures.ts` —
 * the canonical Pro-capability registry. The Pro feature copy below pulls shipped
 * labels from there so the two never drift.
 */

import { PRO_FEATURES } from '@/lib/proFeatures';

/**
 * 'enterprise' is reserved for future manually-negotiated deals (memory.md,
 * 2026-08-12) — an admin sets `profiles.plan = 'enterprise'` by hand for a
 * customer past Team's 40-member cap. There is NO self-serve checkout for it:
 * it's deliberately absent from `PLANS`/`PLAN_ORDER` so it never renders as a
 * priced card (a 4th priced tier measurably hurts pricing-page conversion —
 * decision log). It still passes `isProOrAbove()` for feature gating, with an
 * unlimited member cap (see the DB trigger).
 */
export type PlanId = 'free' | 'pro' | 'team' | 'enterprise';

/** How a paid plan is billed. Maps to a distinct Dodo product per interval. */
export type BillingInterval = 'month' | 'year';

export interface Plan {
  id: PlanId;
  name: string;
  /** Monthly price in USD. 0 for free. Display only — Dodo holds real prices. */
  priceMonthly: number;
  /**
   * Total price in USD when billed yearly (already discounted). `null` when the
   * plan has no annual option (Free). Display only — create a matching yearly
   * Dodo product and wire it as DODO_PRODUCT_PRO_ANNUAL.
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

/** Free-tier caps. Keep in sync with the `projects` / `project_members` triggers
 * in `supabase/migrations/20260812000000_tighten_free_limits.sql`. Lowered from
 * 10/3 on 2026-08-12 — the old limits let a full 3-person team run indefinitely
 * on Free, which undercut conversion (decision log, memory.md). */
export const FREE_PROJECT_LIMIT = 3;
export const FREE_MEMBER_LIMIT = 2;

/** Pro's per-board member cap. Keep in sync with `enforce_member_limit()` in
 * `supabase/migrations/20260812020000_team_plan.sql`. Added 2026-08-12 — Pro
 * boards previously had NO member cap at all, which under-monetized large
 * teams sharing one subscription (decision log, memory.md). */
export const PRO_MEMBER_LIMIT = 10;

/** Team's per-board member cap. A PLATFORM ceiling (Supabase's shared realtime
 * connection budget), not a monetization one — see the migration comment.
 * Anything bigger is a manual/negotiated 'enterprise' account, not self-serve. */
export const TEAM_MEMBER_LIMIT = 40;

/** Mailto link for teams past TEAM_MEMBER_LIMIT — no self-serve Enterprise
 * checkout exists yet; this is a lightweight lead-capture CTA (decision log,
 * memory.md, 2026-08-12), not a priced pricing-page tier. */
export const ENTERPRISE_CONTACT_EMAIL = 'nvexis14@gmail.com';

/** Discount applied to annual billing vs. paying monthly for a full year.
 * Raised from 5% on 2026-08-12 to make annual meaningfully cheaper AND more
 * fee-efficient (Dodo's flat $0.40/transaction fee bites monthly harder). The
 * same rate applies uniformly across every paid plan (Pro, Team) so the
 * discount story stays one consistent rule, not tier-specific arithmetic. */
export const PRO_ANNUAL_DISCOUNT_PCT = 33;

export const PLANS: Record<'free' | 'pro' | 'team', Plan> = {
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
    // 5.99 × 12 = 71.88, less PRO_ANNUAL_DISCOUNT_PCT (33%) ≈ 47.99 (≈ $4.00/mo).
    priceAnnual: 47.99,
    tagline: 'For power users and small teams who need room to scale.',
    projectLimit: null,
    memberLimit: PRO_MEMBER_LIMIT,
    features: [
      'Unlimited project boards',
      `Collaborate with up to ${PRO_MEMBER_LIMIT} people per board`,
      'Everything in Free',
      PRO_FEATURES.emailReminders.label,
      PRO_FEATURES.customReminders.label,
      'Priority support',
    ],
  },
  team: {
    id: 'team',
    name: 'Team',
    priceMonthly: 22,
    // 22 × 12 = 264, less PRO_ANNUAL_DISCOUNT_PCT (33%) ≈ 174.99 (≈ $14.58/mo).
    priceAnnual: 174.99,
    tagline: 'For classrooms, studios and teams who need everyone on board.',
    projectLimit: null,
    memberLimit: TEAM_MEMBER_LIMIT,
    features: [
      'Everything in Pro',
      `Collaborate with up to ${TEAM_MEMBER_LIMIT} people per board`,
      'One subscription covers your whole team or class',
      'Priority support',
    ],
  },
};

/** A plan that has a real `PLANS` entry — i.e. everything except 'enterprise',
 * which has no self-serve price (see the `PlanId` doc comment). */
export type PricedPlanId = keyof typeof PLANS;

/** Display copy for 'enterprise' accounts — no `PLANS` entry (no self-serve
 * price to show), but the Billing page and `PlanBadge` still need something to
 * render for the rare manually-provisioned account. */
export const ENTERPRISE_DISPLAY = {
  name: 'Enterprise',
  tagline: 'A custom plan for your organization, set up directly with us.',
  features: ['Everything in Team', 'Unlimited collaborators per board', 'Dedicated support'],
} as const;

/** Self-serve, priced tiers only — drives every pricing card + upgrade picker.
 * 'enterprise' is deliberately excluded (see the PlanId doc comment above). */
export const PLAN_ORDER: PricedPlanId[] = ['free', 'pro', 'team'];

/** True for any plan at or above Pro — the shared "has Pro-gated features"
 * check used by `useIsPro`, `ProGate`, and `PlanBadge` (all three previously
 * checked `plan === 'pro'` directly, which silently excluded Team/Enterprise
 * users from features they're paying for). */
export function isProOrAbove(plan: PlanId): boolean {
  return plan === 'pro' || plan === 'team' || plan === 'enterprise';
}

/** The owned-board cap for a plan (`null` = unlimited; 'enterprise' has no
 * `PLANS` entry and is always unlimited). */
export function planProjectLimit(plan: PlanId): number | null {
  return plan === 'enterprise' ? null : PLANS[plan].projectLimit;
}

/** True when a user on `plan` who owns `ownedCount` boards can't create more. */
export function isAtProjectLimit(plan: PlanId, ownedCount: number): boolean {
  const limit = planProjectLimit(plan);
  return limit !== null && ownedCount >= limit;
}

/** Max members per board for a plan (`null` = unlimited). Mirrors
 * `enforce_member_limit()` in `supabase/migrations/20260812020000_team_plan.sql`
 * (free=2, pro=10, team=40, enterprise=unlimited). */
export function planMemberLimit(plan: PlanId): number | null {
  return plan === 'enterprise' ? null : PLANS[plan].memberLimit;
}

/** True when a board owned by `plan` with `memberCount` members can't add more. */
export function isAtMemberLimit(plan: PlanId, memberCount: number): boolean {
  const limit = planMemberLimit(plan);
  return limit !== null && memberCount >= limit;
}

/** Price for a plan at a given billing interval (falls back to 12× monthly).
 * Only priced plans have a price — pass a `PricedPlanId`, not 'enterprise'. */
export function planPrice(plan: PricedPlanId, interval: BillingInterval): number {
  const p = PLANS[plan];
  if (interval === 'year') return p.priceAnnual ?? p.priceMonthly * 12;
  return p.priceMonthly;
}

/** Effective per-month cost when billed annually (`null` if no annual price). */
export function annualPerMonth(plan: PricedPlanId): number | null {
  const p = PLANS[plan];
  return p.priceAnnual === null ? null : Number((p.priceAnnual / 12).toFixed(2));
}

/** Dollars saved per year by paying annually vs. monthly (`null` if no annual). */
export function annualSavings(plan: PricedPlanId): number | null {
  const p = PLANS[plan];
  return p.priceAnnual === null ? null : Number((p.priceMonthly * 12 - p.priceAnnual).toFixed(2));
}
