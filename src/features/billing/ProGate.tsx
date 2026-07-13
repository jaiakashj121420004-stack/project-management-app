import { useState, type ReactNode } from 'react';
import { Sparkles } from 'lucide-react';
import { GlassPanel } from '@/components/glass/GlassPanel';
import { GradientButton } from '@/components/buttons/GradientButton';
import { useProfile } from '@/features/auth/useProfile';
import { UpgradeModal } from './UpgradeModal';

interface ProGateProps {
  /** What Pro users see. */
  children: ReactNode;
  /**
   * Headline for the default locked card, e.g.
   * "The Notes Canvas is a Pro feature."
   */
  title?: string;
  /** Sub-line; also passed to the UpgradeModal as its reason. */
  reason?: string;
  /** Replace the default glass upgrade card with your own locked-state UI. */
  fallback?: ReactNode;
  /**
   * Override the gate with an explicit Pro flag. Use for PROJECT-scoped features
   * where the board owner's plan governs (useProjectIsPro), not the viewer's own.
   * When set, the caller owns the loading state; when omitted, the viewer's
   * profile plan is used.
   */
  isPro?: boolean;
}

/**
 * Renders `children` for Pro users; otherwise shows an upgrade CTA that opens the
 * existing `UpgradeModal`. UX gate only — RLS + `project_is_pro()` are the real
 * enforcement (plan.md §6). While the plan is still loading we render nothing so
 * the upgrade prompt never flashes for a user who turns out to be Pro.
 */
export function ProGate({ children, title, reason, fallback, isPro }: ProGateProps) {
  const { data: profile, isLoading } = useProfile();
  const [modalOpen, setModalOpen] = useState(false);

  const unlocked = isPro ?? profile?.plan === 'pro';
  // Only self-suppress while loading when WE own the plan check (no override).
  if (isPro === undefined && isLoading && !profile) return null;
  if (unlocked) return <>{children}</>;
  if (fallback) return <>{fallback}</>;

  return (
    <>
      <GlassPanel
        glow
        className="flex flex-col items-center gap-4 p-8 text-center sm:p-10"
      >
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[linear-gradient(135deg,var(--accent-from),var(--accent-to))] text-[var(--accent-fg)] shadow-[0_10px_30px_-10px_var(--accent-glow)]">
          <Sparkles size={22} />
        </span>
        <div className="flex flex-col gap-1.5">
          <h3 className="font-display text-title font-bold text-fg">
            {title ?? 'This is a Pro feature'}
          </h3>
          <p className="max-w-sm text-sm text-fg-muted">
            {reason ?? 'Upgrade to Pro to unlock it. Cancel anytime.'}
          </p>
        </div>
        <GradientButton leftIcon={<Sparkles size={17} />} onClick={() => setModalOpen(true)}>
          Upgrade to Pro
        </GradientButton>
      </GlassPanel>

      <UpgradeModal open={modalOpen} onClose={() => setModalOpen(false)} reason={reason} />
    </>
  );
}
