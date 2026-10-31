import type { ReactNode } from 'react';
import {
  Eraser,
  Highlighter,
  Lasso,
  Maximize2,
  Minimize2,
  MousePointer,
  Pen,
  Redo2,
  SquareDashed,
  Type,
  Undo2,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { PEN_PRESETS, type PenSettings } from './drawing';
import type { CanvasTool } from './constants';
import type { ShapeKind } from './elements';
import { ShapePicker } from './ShapePicker';

interface InkDockProps {
  tool: CanvasTool;
  onTool: (tool: CanvasTool) => void;
  pen: PenSettings;
  onPen: (next: PenSettings) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  focus: boolean;
  onToggleFocus: () => void;
  shapeKind: ShapeKind;
  onPickShape: (kind: ShapeKind) => void;
  className?: string;
}

/**
 * The always-visible writing dock: Pen, Highlighter, Eraser, Select and Text as
 * large labelled buttons (touch-sized for a finger or Apple Pencil), plus
 * undo/redo and the full-screen toggle. Picking Pen/Highlighter switches to the
 * draw tool AND the right preset in one tap, so there's never a hunt for it.
 */
export function InkDock({
  tool,
  onTool,
  pen,
  onPen,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  focus,
  onToggleFocus,
  shapeKind,
  onPickShape,
  className,
}: InkDockProps) {
  const drawing = tool === 'draw';
  const penActive = drawing && pen.preset !== 'highlighter';
  const highlighterActive = drawing && pen.preset === 'highlighter';

  function pickPreset(preset: 'pen' | 'highlighter') {
    // Keep the colour; reset the size to the new preset's natural default.
    onPen({ ...pen, preset, size: PEN_PRESETS[preset].size });
    onTool('draw');
  }

  return (
    <div
      role="toolbar"
      data-palm-safe
      aria-label="Writing tools"
      className={cn(
        'glass-menu flex max-w-full items-center gap-1 overflow-x-auto rounded-3xl border border-[var(--glass-border)] p-1.5 shadow-[0_18px_44px_-16px_rgba(0,0,0,0.75)]',
        className,
      )}
    >
      <DockButton label="Pen" active={penActive} onClick={() => pickPreset('pen')}>
        <Pen size={22} />
      </DockButton>
      <DockButton label="Highlight" active={highlighterActive} onClick={() => pickPreset('highlighter')}>
        <Highlighter size={22} />
      </DockButton>
      <DockButton label="Eraser" active={tool === 'erase'} onClick={() => onTool('erase')}>
        <Eraser size={22} />
      </DockButton>
      <DockButton label="Select" active={tool === 'select'} onClick={() => onTool('select')}>
        <MousePointer size={22} />
      </DockButton>
      <DockButton label="Lasso" active={tool === 'lasso'} onClick={() => onTool('lasso')}>
        <Lasso size={22} />
      </DockButton>
      <DockButton label="Box" active={tool === 'marquee'} onClick={() => onTool('marquee')}>
        <SquareDashed size={22} />
      </DockButton>
      <ShapePicker variant="dock" kind={shapeKind} active={tool === 'shape'} onPick={onPickShape} />
      <DockButton label="Text" active={tool === 'text'} onClick={() => onTool('text')}>
        <Type size={22} />
      </DockButton>

      <span className="mx-1 h-9 w-px bg-[var(--glass-border)]" aria-hidden />

      <DockButton label="Undo" onClick={onUndo} disabled={!canUndo}>
        <Undo2 size={21} />
      </DockButton>
      <DockButton label="Redo" onClick={onRedo} disabled={!canRedo}>
        <Redo2 size={21} />
      </DockButton>

      <span className="mx-1 h-9 w-px bg-[var(--glass-border)]" aria-hidden />

      <DockButton label={focus ? 'Exit' : 'Full screen'} onClick={onToggleFocus}>
        {focus ? <Minimize2 size={21} /> : <Maximize2 size={21} />}
      </DockButton>
    </div>
  );
}

function DockButton({
  label,
  active = false,
  disabled = false,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      aria-label={label}
      className={cn(
        'flex h-14 min-w-[3.5rem] flex-col items-center justify-center gap-0.5 rounded-2xl px-2 text-[0.68rem] font-semibold leading-none transition-colors disabled:opacity-35',
        active
          ? 'bg-[linear-gradient(110deg,var(--accent-from),var(--accent-to))] text-[var(--accent-fg)] shadow-md'
          : 'text-fg-muted hover:bg-[var(--glass-fill)] hover:text-fg',
      )}
    >
      {children}
      <span>{label}</span>
    </button>
  );
}
