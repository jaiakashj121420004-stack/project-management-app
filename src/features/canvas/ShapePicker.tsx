import { useState } from 'react';
import { Shapes } from 'lucide-react';
import { cn } from '@/lib/cn';
import { ToolbarPopover } from '@/components/forms/ToolbarPopover';
import type { ShapeKind } from './elements';
import { isLineKind, shapeLabel, shapePathData, SHAPE_CATALOG } from './shapes';

interface ShapePickerProps {
  /** The shape currently armed (highlighted while the shape tool is active). */
  kind: ShapeKind;
  active: boolean;
  onPick: (kind: ShapeKind) => void;
  /** Dock-sized (labelled) trigger vs. compact toolbar icon. */
  variant: 'dock' | 'icon';
}

/** A tiny drawing of a shape for the picker grid. */
function ShapeGlyph({ kind }: { kind: ShapeKind }) {
  const s = 30;
  if (isLineKind(kind)) {
    const head = kind === 'arrow' || kind === 'double-arrow' || kind === 'elbow-arrow';
    const d = kind === 'elbow-arrow' ? 'M3 24H15V6H27' : 'M3 24L27 6';
    return (
      <svg width={s} height={s} viewBox="0 0 30 30" aria-hidden fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d={d} />
        {head && <path d={kind === 'elbow-arrow' ? 'M22 1.5L27 6L22 10.5' : 'M19 6H27V14'} />}
        {kind === 'double-arrow' && <path d="M3 16V24H11" />}
      </svg>
    );
  }
  const d = shapePathData(kind, 24, 24);
  return (
    <svg width={s} height={s} viewBox="-3 -3 30 30" aria-hidden fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

/**
 * The shapes menu: lines & arrows, basic shapes, flowchart blocks, symbols. Picking
 * one arms the shape tool — then drag on the canvas to draw it (or just click).
 */
export function ShapePicker({ kind, active, onPick, variant }: ShapePickerProps) {
  const [open, setOpen] = useState(false);

  const trigger =
    variant === 'dock' ? (
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Shapes and arrows"
        aria-pressed={active}
        aria-expanded={open}
        className={cn(
          'flex h-14 min-w-[3.5rem] flex-col items-center justify-center gap-0.5 rounded-2xl px-2 text-[0.68rem] font-semibold leading-none transition-colors',
          active
            ? 'bg-[linear-gradient(110deg,var(--accent-from),var(--accent-to))] text-[var(--accent-fg)] shadow-md'
            : 'text-fg-muted hover:bg-[var(--glass-fill)] hover:text-fg',
        )}
      >
        <Shapes size={22} />
        <span>Shapes</span>
      </button>
    ) : (
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Shapes and arrows"
        title="Shapes, arrows and flowchart blocks"
        aria-pressed={active}
        className={cn(
          'grid h-9 w-9 shrink-0 place-items-center rounded-xl transition-colors hover:bg-[var(--glass-fill)] hover:text-fg',
          active
            ? 'bg-[linear-gradient(110deg,var(--accent-from),var(--accent-to))] text-[var(--accent-fg)]'
            : 'text-fg-muted',
        )}
      >
        <Shapes size={17} />
      </button>
    );

  return (
    <ToolbarPopover open={open} onClose={() => setOpen(false)} title="Shapes & flowchart" trigger={trigger}>
      <div className="flex max-h-[60vh] w-[19rem] max-w-full flex-col gap-3 overflow-y-auto pr-1">
        {SHAPE_CATALOG.map((group) => (
          <section key={group.id}>
            <h3 className="mb-1.5 font-mono text-[0.65rem] uppercase tracking-[0.14em] text-fg-subtle">
              {group.label}
            </h3>
            <div className="grid grid-cols-4 gap-1.5">
              {group.items.map((item) => (
                <button
                  key={`${group.id}-${item.label}`}
                  type="button"
                  title={item.label}
                  aria-label={item.label}
                  onClick={() => {
                    onPick(item.kind);
                    setOpen(false);
                  }}
                  className={cn(
                    'flex flex-col items-center gap-1 rounded-xl border border-transparent px-1 py-2 text-[0.62rem] leading-tight text-fg-muted transition-colors hover:border-[var(--glass-border)] hover:bg-[var(--glass-fill)] hover:text-fg',
                    active && kind === item.kind && 'border-[var(--accent-from)] text-fg',
                  )}
                >
                  <ShapeGlyph kind={item.kind} />
                  <span className="line-clamp-2 text-center">{shapeLabel(item.kind) === item.label ? item.label : item.label}</span>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </ToolbarPopover>
  );
}
