import { useState } from 'react';
import { Check, Sparkles } from 'lucide-react';
import { Modal } from '@/components/Modal';
import { GradientButton } from '@/components/buttons/GradientButton';
import {
  PLANS,
  annualPerMonth,
  annualSavings,
  planPrice,
  PRO_ANNUAL_DISCOUNT_PCT,
  type BillingInterval,
} from '@/lib/plans';
import { useBilling } from './useBilling';
import { IntervalToggle } from './IntervalToggle';

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
  const [interval, setInterval] = useState<BillingInterval>('month');
  const pro = PLANS.pro;
  const annual = interval === 'year';
  const perMonth = annual ? (annualPerMonth('pro') ?? pro.priceMonthly) : pro.priceMonthly;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Upgrade to Pro"
      description={reason ?? 'Unlock unlimited projects and more.'}
    >
      <div className="flex flex-col gap-5">
        <IntervalToggle value={interval} onChange={setInterval} />

        <div>
          <div className="flex items-baseline gap-1.5">
            <span className="gradient-text font-display text-headline font-bold">
              ${perMonth.toFixed(2)}
            </span>
            <span className="text-fg-muted">/ month</span>
          </div>
          {annual && (
            <p className="mt-1 text-sm text-fg-muted">
              ${planPrice('pro', 'year').toFixed(2)} billed yearly — save $
              {(annualSavings('pro') ?? 0).toFixed(2)} ({PRO_ANNUAL_DISCOUNT_PCT}%)
            </p>
          )}
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
            onClick={() => startCheckout(interval)}
          >
            {annual ? 'Get Pro yearly' : 'Upgrade to Pro'}
          </GradientButton>
        </div>

        <p className="text-center text-xs text-fg-subtle">
          Secure checkout via Dodo Payments. Cancel anytime.
        </p>
      </div>
    </Modal>
  );
}
