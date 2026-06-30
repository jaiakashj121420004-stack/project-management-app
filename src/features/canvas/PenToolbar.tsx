import { useEffect, useRef, useState } from 'react';
import { Brush, Highlighter, Pen, Pipette } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';
import { ColorPicker } from './ColorPicker';
import {
  PEN_COLORS,
  PEN_PRESETS,
  PEN_PRESET_ORDER,
  type PenPreset,
  type PenSettings,
} from './drawing';

interface PenToolbarProps {
  settings: PenSettings;
  onChange: (next: PenSettings) => void;
  className?: string;
}

const PRESET_ICONS: Record<PenPreset, LucideIcon> = {
  pen: Pen,
  marker: Brush,
  highlighter: Highlighter,
};

/**
 * The contextual pen toolbar, shown only in draw mode: pick a preset
 * (pen / marker / highlighter), a colour, and a size. Switching preset resets
 * the size to that preset's default; the slider then fine-tunes within the
 * preset's range. Wraps so the dropdown-free row never scroll-clips.
 */
export function PenToolbar({ settings, onChange, className }: PenToolbarProps) {
  const spec = PEN_PRESETS[settings.preset];
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!pickerOpen) return;
    const onDown = (e: PointerEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setPickerOpen(false);
    };
    document.addEventListener('pointerdown', onDown, true);
    return () => document.removeEventListener('pointerdown', onDown, true);
  }, [pickerOpen]);

  const customActive = !PEN_COLORS.some((c) => c.toLowerCase() === settings.color.toLowerCase());

  return (
    <div
      role="toolbar"
      aria-label="Pen settings"
      className={cn(
        'glass-menu flex max-w-full flex-wrap items-center justify-center gap-2 rounded-2xl border border-[var(--glass-border)] px-2 py-1.5 shadow-[0_14px_34px_-18px_rgba(0,0,0,0.7)]',
        className,
      )}
    >
      <div className="flex items-center gap-1">
        {PEN_PRESET_ORDER.map((preset) => {
          const Icon = PRESET_ICONS[preset];
          const active = settings.preset === preset;
          return (
            <button
              key={preset}
              type="button"
              onClick={() =>
                onChange({ ...settings, preset, size: PEN_PRESETS[preset].size })
              }
              aria-pressed={active}
              title={PEN_PRESETS[preset].label}
              className={cn(
                'flex h-9 items-center gap-1.5 rounded-xl px-2.5 text-xs font-semibold transition-colors',
                active
                  ? 'bg-[linear-gradient(110deg,var(--accent-from),var(--accent-to))] text-white'
                  : 'text-fg-muted hover:bg-[var(--glass-fill)] hover:text-fg',
              )}
            >
              <Icon size={15} />
              <span className="hidden sm:inline">{PEN_PRESETS[preset].label}</span>
            </button>
          );
        })}
      </div>

      <Divider />

      <div className="flex items-center gap-1.5" role="radiogroup" aria-label="Pen colour">
        {PEN_COLORS.map((color) => {
          const active = settings.color.toLowerCase() === color.toLowerCase();
          return (
            <button
              key={color}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={color}
              title={color}
              onClick={() => onChange({ ...settings, color })}
              className={cn(
                'h-6 w-6 rounded-full border transition-transform',
                active
                  ? 'scale-110 border-white ring-2 ring-[var(--accent-from)]'
                  : 'border-black/10 hover:scale-105 dark:border-white/20',
              )}
              style={{ backgroundColor: color }}
            />
          );
        })}

        {/* Custom colour (spectrum + hex) */}
        <div ref={pickerRef} className="relative">
          <button
            type="button"
            aria-label="Custom colour"
            title="Custom colour"
            aria-pressed={pickerOpen}
            onClick={() => setPickerOpen((o) => !o)}
            className={cn(
              'grid h-6 w-6 place-items-center rounded-full border transition-transform',
              customActive
                ? 'scale-110 border-white ring-2 ring-[var(--accent-from)]'
                : 'border-black/10 hover:scale-105 dark:border-white/20',
            )}
            style={customActive ? { backgroundColor: settings.color } : undefined}
          >
            {!customActive && <Pipette size={13} className="text-fg-muted" />}
          </button>
          {pickerOpen && (
            <div className="glass-menu absolute left-1/2 top-full z-30 mt-2 -translate-x-1/2 rounded-xl border border-[var(--glass-border)] p-2 shadow-[0_14px_34px_-18px_rgba(0,0,0,0.7)]">
              <ColorPicker
                color={settings.color}
                presets={PEN_COLORS}
                onChange={(hex) => onChange({ ...settings, color: hex })}
              />
            </div>
          )}
        </div>
      </div>

      <Divider />

      <label className="flex items-center gap-2 text-xs font-medium text-fg-muted">
        <span className="hidden sm:inline">Size</span>
        <input
          type="range"
          min={spec.minSize}
          max={spec.maxSize}
          step={1}
          value={settings.size}
          onChange={(event) => onChange({ ...settings, size: Number(event.target.value) })}
          aria-label="Pen size"
          className="h-1.5 w-24 cursor-pointer appearance-none rounded-full bg-[var(--glass-border)] accent-[var(--accent-from)]"
        />
        <span className="w-6 text-right tabular-nums text-fg-subtle">{settings.size}</span>
      </label>
    </div>
  );
}

function Divider() {
  return <span className="mx-0.5 h-6 w-px bg-[var(--glass-border)]" aria-hidden />;
}
