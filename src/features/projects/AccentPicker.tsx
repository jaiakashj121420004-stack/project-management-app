import { Check } from 'lucide-react';
import { ACCENTS, ACCENT_NAMES, accentGradient, accentVars, type AccentName } from '@/lib/accents';
import { cn } from '@/lib/cn';

interface AccentPickerProps {
  value: AccentName;
  onChange: (accent: AccentName) => void;
  label?: string;
}

/** Pick one of the six Aurora accent gradients (plan.md §4.2). A real radiogroup
 *  so it's keyboard- and screen-reader-friendly. */
export function AccentPicker({ value, onChange, label = 'Accent' }: AccentPickerProps) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-fg-muted">{label}</span>
      <div role="radiogroup" aria-label={label} className="grid grid-cols-3 gap-2.5 sm:grid-cols-6">
        {ACCENT_NAMES.map((name) => {
          const selected = name === value;
          return (
            <button
              key={name}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={ACCENTS[name].label}
              title={ACCENTS[name].label}
              onClick={() => onChange(name)}
              style={{ ...accentVars(name), background: accentGradient(name) }}
              className={cn(
                'relative grid h-12 place-items-center rounded-2xl text-[var(--accent-fg)]',
                'ring-2 ring-offset-2 ring-offset-transparent transition-transform duration-200',
                'hover:-translate-y-0.5 focus:outline-none focus-visible:ring-white',
                selected
                  ? 'ring-white shadow-[0_12px_26px_-10px_var(--accent-glow)]'
                  : 'ring-transparent',
              )}
            >
              {selected && <Check size={18} aria-hidden />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
