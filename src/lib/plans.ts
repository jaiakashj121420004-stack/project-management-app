/**
 * Plan model — the single source of truth for what Free vs Pro offer.
 *
 * Limits are presentational here AND enforced server-side (triggers on
 * `projects` and `project_members` re-check them), so the UI and the database
 * can never disagree. Stripe is the source of truth for *who* is on which plan —
 * the app only ever reads `profiles.plan`, set by the verified webhook. See
 * plan.md → Billing.
 */

export type PlanId = 'free' | 'pro';

export interface Plan {
  id: PlanId;
  name: string;
  /** Monthly price in USD. 0 for free. Display only — Stripe holds real prices. */
  priceMonthly: number;
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

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: 'free',
    name: 'Free',
    priceMonthly: 0,
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
    priceMonthly: 8,
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
