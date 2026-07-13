import { useEffect, useRef, useState } from 'react';
import { Brush, ChevronDown, ChevronUp, Highlighter, Pen, Pipette } from 'lucide-react';
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
const COLLAPSE_KEY = 'canvas-pen-collapsed';

export function PenToolbar({ settings, onChange, className }: PenToolbarProps) {
  const spec = PEN_PRESETS[settings.preset];
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === '1';
    } catch {
      return false;
    }
  });

  function toggleCollapsed() {
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  // NOTE: every hook must run before the early `if (collapsed) return` below —
  // otherwise collapsing changes the hook count between renders and React throws
  // "rendered fewer hooks than expected", blanking the whole app.
  useEffect(() => {
    if (!pickerOpen) return;
    const onDown = (e: PointerEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setPickerOpen(false);
    };
    document.addEventListener('pointerdown', onDown, true);
    return () => document.removeEventListener('pointerdown', onDown, true);
  }, [pickerOpen]);

  // Collapsed: a compact bar showing the current preset + colour + size, with a
  // chevron to reopen the full options. Keeps the canvas clear on small screens.
  if (collapsed) {
    const ActiveIcon = PRESET_ICONS[settings.preset];
    return (
      <div
        role="toolbar"
        aria-label="Pen settings"
        className={cn(
          'glass-menu flex items-center gap-2 rounded-2xl border border-[var(--glass-border)] px-2.5 py-1.5 shadow-[0_14px_34px_-18px_rgba(0,0,0,0.7)]',
          className,
        )}
      >
        <ActiveIcon size={15} className="text-fg-muted" />
        <span
          className="h-5 w-5 rounded-full border border-black/10 dark:border-white/20"
          style={{ backgroundColor: settings.color }}
          aria-hidden
        />
        <span className="w-5 text-right text-xs tabular-nums text-fg-subtle">{settings.size}</span>
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label="Show pen options"
          title="Show pen options"
          className="grid h-7 w-7 place-items-center rounded-lg text-fg-muted transition-colors hover:bg-[var(--glass-fill)] hover:text-fg"
        >
          <ChevronDown size={16} />
        </button>
      </div>
    );
  }

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
                  ? 'bg-[linear-gradient(110deg,var(--accent-from),var(--accent-to))] text-[var(--accent-fg)]'
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

      <Divider />
      <button
        type="button"
        onClick={toggleCollapsed}
        aria-label="Hide pen options"
        title="Hide pen options"
        className="grid h-7 w-7 place-items-center rounded-lg text-fg-muted transition-colors hover:bg-[var(--glass-fill)] hover:text-fg"
      >
        <ChevronUp size={16} />
      </button>
    </div>
  );
}

function Divider() {
  return <span className="mx-0.5 h-6 w-px bg-[var(--glass-border)]" aria-hidden />;
}
