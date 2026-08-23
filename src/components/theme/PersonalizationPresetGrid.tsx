import { Check } from 'lucide-react';
import {
  PERSONALIZATION_PRESETS,
  PERSONALIZATION_PRESET_IDS,
  type PersonalizationPresetId,
} from '@/lib/personalizationPresets';
import { cn } from '@/lib/cn';

interface PersonalizationPresetGridProps {
  value: PersonalizationPresetId | null;
  onChange: (id: PersonalizationPresetId) => void;
  label?: string;
}

/**
 * Pick one of the curated personalization presets (Settings → Custom
 * colors). Same visual language as `AccentPicker` — a real radiogroup, hover
 * lift, a check mark on the selected tile — but each swatch previews a full
 * coordinated set (background + text + accent gradient), not just one hue.
 * That's the whole point of leading with this grid: every option already
 * looks intentional, unlike a raw color-wheel pick (see the "Advanced"
 * disclosure below this in SettingsPage for that power-user path).
 */
export function PersonalizationPresetGrid({
  value,
  onChange,
  label = 'Personalization presets',
}: PersonalizationPresetGridProps) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-fg-muted">{label}</span>
      <div
        role="radiogroup"
        aria-label={label}
        className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
      >
        {PERSONALIZATION_PRESET_IDS.map((id) => {
          const preset = PERSONALIZATION_PRESETS[id];
          const selected = id === value;
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={`${preset.label} — ${preset.description}`}
              title={preset.description}
              onClick={() => onChange(id)}
              style={{ background: preset.bg, borderColor: 'rgba(0,0,0,0.12)' }}
              className={cn(
                'relative flex cursor-pointer flex-col items-start gap-2 overflow-hidden rounded-2xl border p-3 text-left',
                'ring-2 ring-offset-2 ring-offset-transparent transition-transform duration-200',
                'hover:-translate-y-0.5 focus:outline-none focus-visible:ring-white',
                selected
                  ? 'ring-white shadow-[0_14px_30px_-12px_rgba(0,0,0,0.4)]'
                  : 'ring-transparent',
              )}
            >
              <span className="flex w-full items-center justify-between gap-2">
                <span
                  style={{ fontFamily: "'Fraunces Variable', Fraunces, Georgia, serif", color: preset.text }}
                  className="text-xl font-semibold"
                >
                  Aa
                </span>
                {selected && (
                  <span
                    style={{ background: preset.accentFrom, color: preset.accentFg }}
                    className="grid h-5 w-5 shrink-0 place-items-center rounded-full"
                  >
                    <Check size={12} aria-hidden />
                  </span>
                )}
              </span>
              <span style={{ color: preset.text }} className="text-xs font-semibold leading-tight">
                {preset.label}
              </span>
              {/* The accent gradient stops, previewed as a small bar — the
                  same coordinated pair the button/highlight tokens pick up
                  when this preset is active. */}
              <span
                aria-hidden
                style={{
                  background: `linear-gradient(110deg, ${preset.accentFrom}, ${preset.accentTo})`,
                }}
                className="h-1.5 w-full rounded-full"
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
