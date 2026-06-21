import { Check, Sparkles } from 'lucide-react';
import { Modal } from '@/components/Modal';
import { GradientButton } from '@/components/buttons/GradientButton';
import { PLANS } from '@/lib/plans';
import { useBilling } from './useBilling';

interface UpgradeModalProps {
  open: boolean;
  onClose: () => void;
  /** Optional context line, e.g. why the user hit this (a reached limit). */
  reason?: string;
}

/** Prompts a free user to upgrade — shown from the Billing page and whenever a
 *  plan limit is reached (e.g. creating one project too many). */
export function UpgradeModal({ open, onClose, reason }: UpgradeModalProps) {
  const { startCheckout, pending, error } = useBilling();
  const pro = PLANS.pro;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Upgrade to Pro"
      description={reason ?? 'Unlock unlimited projects and more.'}
    >
      <div className="flex flex-col gap-5">
        <div className="flex items-baseline gap-1.5">
          <span className="gradient-text font-display text-headline font-bold">${pro.priceMonthly}</span>
          <span className="text-fg-muted">/ month</span>
        </div>

        <ul className="flex flex-col gap-2.5">
          {pro.features.map((feature) => (
            <li key={feature} className="flex items-start gap-2.5 text-sm text-fg">
              <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[linear-gradient(135deg,var(--accent-from),var(--accent-to))] text-white">
                <Check size={13} strokeWidth={3} />
              </span>
              {feature}
            </li>
          ))}
        </ul>

        {error && (
          <p className="rounded-2xl border border-danger/30 bg-danger/10 px-3.5 py-2.5 text-sm text-danger">
            {error}
          </p>
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <GradientButton variant="ghost" onClick={onClose}>
            Maybe later
          </GradientButton>
          <GradientButton
            leftIcon={<Sparkles size={17} />}
            isLoading={pending === 'checkout'}
            onClick={startCheckout}
          >
            Upgrade to Pro
          </GradientButton>
        </div>

        <p className="text-center text-xs text-fg-subtle">
          Secure checkout via Stripe. Cancel anytime.
        </p>
      </div>
    </Modal>
  );
}
