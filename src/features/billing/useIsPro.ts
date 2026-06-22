import { useProfile } from '@/features/auth/useProfile';

/**
 * True when the current user is on the Pro plan.
 *
 * This is a UX gate ONLY — the real enforcement is `project_is_pro()` in RLS and
 * the `canvas-media` Storage policies (plan.md §6, prompts.md P0). For a shared
 * board the board OWNER's plan governs; this hook is for the signed-in user's own
 * plan (use it to unlock personal Pro affordances and to gate the upgrade CTA).
 *
 * Returns `false` while the profile is still loading; pair with `<ProGate>` (or
 * `useProfile().isLoading`) when you need to avoid flashing an upgrade prompt.
 */
export function useIsPro(): boolean {
  const { data: profile } = useProfile();
  return profile?.plan === 'pro';
}
