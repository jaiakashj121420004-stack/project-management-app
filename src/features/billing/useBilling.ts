import { useState } from 'react';
import { createCheckoutUrl, createPortalUrl } from './api';

type Pending = 'checkout' | 'portal' | null;

/**
 * Drives the two billing actions. Both end in a full-page redirect to Stripe,
 * so `pending` simply stays set until the browser navigates away (or we reset
 * it on error). No optimistic plan change here — the plan only flips once the
 * verified webhook updates the database.
 */
export function useBilling() {
  const [pending, setPending] = useState<Pending>(null);
  const [error, setError] = useState<string | null>(null);

  async function go(kind: Exclude<Pending, null>): Promise<void> {
    setPending(kind);
    setError(null);
    try {
      const url = kind === 'checkout' ? await createCheckoutUrl() : await createPortalUrl();
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

  return {
    startCheckout: () => void go('checkout'),
    openPortal: () => void go('portal'),
    pending,
    error,
  };
}
