import { useState } from 'react';
import { Ban } from 'lucide-react';
import { cn } from '@/lib/cn';
import { ToolbarPopover } from '@/components/forms/ToolbarPopover';
import { ColorPicker } from './ColorPicker';
import { PEN_COLORS } from './drawing';
import { isLineKind } from './shapes';
import type { ElementPatch, ShapeDash, ShapeElement } from './elements';

interface ShapeStyleBarProps {
  shapes: ShapeElement[];
  onPatch: (patch: ElementPatch) => void;
  className?: string;
}

/** Soft fills that read on both the light and the dark canvas. */
const FILL_PRESETS: readonly string[] = [
  '#fde68a', '#fecaca', '#fed7aa', '#bbf7d0', '#a5f3fc', '#bfdbfe', '#ddd6fe', '#fbcfe8',
  '#ffffff', '#cbd5e1', '#0f172a', '#7a2a26',
];

const DASHES: ReadonlyArray<{ value: ShapeDash; label: string; pattern: string }> = [
  { value: 'solid', label: 'Solid line', pattern: '' },
  { value: 'dashed', label: 'Dashed line', pattern: '6 4' },
  { value: 'dotted', label: 'Dotted line', pattern: '1.5 4' },
];

/**
 * The style strip that appears under a selected shape / arrow: fill, outline
 * colour (full spectrum — not a fixed handful), thickness and line style. Edits
 * apply to every selected shape at once.
 */
export function ShapeStyleBar({ shapes, onPatch, className }: ShapeStyleBarProps) {
  const [open, setOpen] = useState<'fill' | 'stroke' | null>(null);
  const first = shapes[0]!;
  const anyClosed = shapes.some((s) => !isLineKind(s.kind));

  return (
    <div
      role="toolbar"
      aria-label="Shape style"
      className={cn(
        'glass-menu flex max-w-full flex-wrap items-center justify-center gap-2 rounded-2xl border border-[var(--glass-border)] px-2.5 py-1.5 shadow-[0_14px_34px_-18px_rgba(0,0,0,0.7)]',
        className,
      )}
    >
      {anyClosed && (
        <ToolbarPopover
          open={open === 'fill'}
          onClose={() => setOpen(null)}
          title="Fill colour"
          trigger={
            <Swatch
              label="Fill colour"
              color={first.fill === 'none' ? null : first.fill}
              active={open === 'fill'}
              onClick={() => setOpen(open === 'fill' ? null : 'fill')}
            />
          }
        >
          <button
            type="button"
            onClick={() => onPatch({ fill: 'none' })}
            className="mb-2 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-medium text-fg-muted hover:bg-[var(--glass-fill)] hover:text-fg"
          >
            <Ban size={14} /> No fill
          </button>
          <ColorPicker
            color={first.fill === 'none' ? '#ffffff' : first.fill}
            presets={FILL_PRESETS}
            onChange={(hex) => onPatch({ fill: hex })}
          />
        </ToolbarPopover>
      )}

      <ToolbarPopover
        open={open === 'stroke'}
        onClose={() => setOpen(null)}
        title="Line colour"
        trigger={
          <Swatch
            label="Line colour"
            color={first.stroke}
            ring
            active={open === 'stroke'}
            onClick={() => setOpen(open === 'stroke' ? null : 'stroke')}
          />
        }
      >
        <ColorPicker
          color={first.stroke}
          presets={PEN_COLORS}
          onChange={(hex) => onPatch({ stroke: hex })}
        />
      </ToolbarPopover>

      <span className="mx-0.5 h-6 w-px bg-[var(--glass-border)]" aria-hidden />

      <label className="flex items-center gap-2 text-xs font-medium text-fg-muted">
        <span className="hidden sm:inline">Thickness</span>
        <input
          type="range"
          min={1}
          max={14}
          step={1}
          value={first.strokeWidth}
          onChange={(e) => onPatch({ strokeWidth: Number(e.target.value) })}
          aria-label="Line thickness"
          className="h-1.5 w-24 cursor-pointer appearance-none rounded-full bg-[var(--glass-border)] accent-[var(--accent-from)]"
        />
      </label>

      <span className="mx-0.5 h-6 w-px bg-[var(--glass-border)]" aria-hidden />

      <div className="flex items-center gap-1" role="radiogroup" aria-label="Line style">
        {DASHES.map((dash) => (
          <button
            key={dash.value}
            type="button"
            role="radio"
            aria-checked={first.dash === dash.value}
            aria-label={dash.label}
            title={dash.label}
            onClick={() => onPatch({ dash: dash.value })}
            className={cn(
              'grid h-9 w-11 place-items-center rounded-xl transition-colors',
              first.dash === dash.value
                ? 'bg-[linear-gradient(110deg,var(--accent-from),var(--accent-to))] text-[var(--accent-fg)]'
                : 'text-fg-muted hover:bg-[var(--glass-fill)] hover:text-fg',
            )}
          >
            <svg width="26" height="6" aria-hidden>
              <line
                x1="2"
                y1="3"
                x2="24"
                y2="3"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeDasharray={dash.pattern}
              />
            </svg>
          </button>
        ))}
      </div>
    </div>
  );
}

function Swatch({
  label,
  color,
  ring = false,
  active,
  onClick,
}: {
  label: string;
  color: string | null;
  ring?: boolean;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      onClick={onClick}
      className="flex h-9 items-center gap-2 rounded-xl px-2 text-xs font-medium text-fg-muted transition-colors hover:bg-[var(--glass-fill)] hover:text-fg"
    >
      <span
        className="grid h-6 w-6 place-items-center rounded-md border border-black/15 dark:border-white/25"
        style={
          ring
            ? { borderColor: color ?? undefined, borderWidth: 3, backgroundColor: 'transparent' }
            : { backgroundColor: color ?? 'transparent' }
        }
      >
        {color === null && <Ban size={13} />}
      </span>
      <span className="hidden sm:inline">{label.replace(' colour', '')}</span>
    </button>
  );
}
