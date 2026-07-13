import type { ReactNode } from 'react';
import { Eraser, Scissors } from 'lucide-react';
import { cn } from '@/lib/cn';
import { ERASER_MAX_SIZE, ERASER_MIN_SIZE, type EraserMode } from './constants';

interface EraserToolbarProps {
  mode: EraserMode;
  onMode: (mode: EraserMode) => void;
  /** Precision nib radius (screen px). */
  size: number;
  onSize: (size: number) => void;
  className?: string;
}

/**
 * The contextual eraser toolbar, shown only in erase mode. Two modes:
 *   - Object: tap a stroke to remove the whole stroke (the original behaviour);
 *   - Precision: scrub to erase only the part you pass over (splits strokes).
 * The size slider sets the precision nib; it's hidden in Object mode.
 */
export function EraserToolbar({ mode, onMode, size, onSize, className }: EraserToolbarProps) {
  return (
    <div
      role="toolbar"
      aria-label="Eraser settings"
      className={cn(
        'glass-menu flex max-w-full flex-wrap items-center justify-center gap-2 rounded-2xl border border-[var(--glass-border)] px-2 py-1.5 shadow-[0_14px_34px_-18px_rgba(0,0,0,0.7)]',
        className,
      )}
    >
      <div className="flex items-center gap-1">
        <ModeButton active={mode === 'object'} onClick={() => onMode('object')} label="Object">
          <Eraser size={15} />
        </ModeButton>
        <ModeButton active={mode === 'precision'} onClick={() => onMode('precision')} label="Precision">
          <Scissors size={15} />
        </ModeButton>
      </div>

      {mode === 'precision' && (
        <>
          <span className="mx-0.5 h-6 w-px bg-[var(--glass-border)]" aria-hidden />
          <label className="flex items-center gap-2 text-xs font-medium text-fg-muted">
            <span className="hidden sm:inline">Size</span>
            <input
              type="range"
              min={ERASER_MIN_SIZE}
              max={ERASER_MAX_SIZE}
              step={1}
              value={size}
              onChange={(e) => onSize(Number(e.target.value))}
              aria-label="Eraser size"
              className="h-1.5 w-24 cursor-pointer appearance-none rounded-full bg-[var(--glass-border)] accent-[var(--accent-from)]"
            />
            <span className="w-6 text-right tabular-nums text-fg-subtle">{size}</span>
          </label>
        </>
      )}
    </div>
  );
}

function ModeButton({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={label}
      className={cn(
        'flex h-9 items-center gap-1.5 rounded-xl px-2.5 text-xs font-semibold transition-colors',
        active
          ? 'bg-[linear-gradient(110deg,var(--accent-from),var(--accent-to))] text-[var(--accent-fg)]'
          : 'text-fg-muted hover:bg-[var(--glass-fill)] hover:text-fg',
      )}
    >
      {children}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
