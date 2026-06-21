import { PRO_ANNUAL_DISCOUNT_PCT, type BillingInterval } from '@/lib/plans';
import { cn } from '@/lib/cn';

const OPTIONS: { value: BillingInterval; label: string }[] = [
  { value: 'month', label: 'Monthly' },
  { value: 'year', label: 'Annual' },
];

/** Segmented Monthly / Annual switch used on every Pro upgrade surface. The
 *  annual option carries a "Save N%" pill so the discount is always visible. */
export function IntervalToggle({
  value,
  onChange,
}: {
  value: BillingInterval;
  onChange: (interval: BillingInterval) => void;
}) {
  return (
    <div className="glass inline-flex rounded-2xl p-1" role="group" aria-label="Billing interval">
      {OPTIONS.map((option) => {
        const active = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-sm font-medium transition-colors',
              active
                ? 'bg-[linear-gradient(135deg,var(--accent-from),var(--accent-to))] text-white shadow-[0_8px_18px_-10px_var(--accent-glow)]'
                : 'text-fg-muted hover:text-fg',
            )}
          >
            {option.label}
            {option.value === 'year' && (
              <span
                className={cn(
                  'rounded-full px-1.5 py-0.5 text-[0.65rem] font-semibold leading-none',
                  active
                    ? 'bg-white/20 text-white'
                    : 'bg-[var(--accent-from)]/15 text-[var(--accent-from)]',
                )}
              >
                Save {PRO_ANNUAL_DISCOUNT_PCT}%
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
