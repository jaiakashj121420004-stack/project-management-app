import { X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { labelHex, withAlpha, type LabelColor } from '@/lib/labelColors';

interface LabelPillProps {
  name: string;
  color: LabelColor;
  /** `dot` = tiny swatch + name (card face); `full` = tinted pill. */
  variant?: 'dot' | 'full';
  /** Render an inline remove (×) button. */
  onRemove?: () => void;
  className?: string;
}

/**
 * A colored project label. The DB stores a palette color *name*; we map it to a
 * hex here (labelColors.ts) and tint the pill with it. Used on the card face, in
 * the card modal, and as a filter chip.
 */
export function LabelPill({ name, color, variant = 'full', onRemove, className }: LabelPillProps) {
  const hex = labelHex(color);

  if (variant === 'dot') {
    return (
      <span
        className={cn('inline-flex items-center gap-1 text-xs font-medium text-fg-muted', className)}
        title={name}
      >
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: hex }} aria-hidden />
        <span className="max-w-[8rem] truncate">{name}</span>
      </span>
    );
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium',
        className,
      )}
      style={{
        backgroundColor: withAlpha(hex, 0.16),
        borderColor: withAlpha(hex, 0.36),
        color: hex,
      }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: hex }} aria-hidden />
      {name}
      {onRemove && (
        <button
          type="button"
          aria-label={`Remove ${name}`}
          onClick={onRemove}
          className="-mr-1 grid h-4 w-4 place-items-center rounded-full transition-colors hover:bg-black/10"
        >
          <X size={11} />
        </button>
      )}
    </span>
  );
}
