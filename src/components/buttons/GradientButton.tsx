import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { accentVars, type AccentName } from '@/lib/accents';
import { Spinner } from '@/components/feedback/Spinner';

type Variant = 'primary' | 'secondary' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

interface GradientButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  accent?: AccentName;
  isLoading?: boolean;
  leftIcon?: ReactNode;
}

const SIZES: Record<Size, string> = {
  sm: 'h-9 px-3.5 text-sm rounded-xl gap-1.5',
  md: 'h-11 px-5 text-[0.95rem] rounded-2xl gap-2',
  lg: 'h-12 px-7 text-base rounded-2xl gap-2.5',
};

const BASE =
  'relative inline-flex select-none items-center justify-center font-medium ' +
  'transition-[transform,box-shadow] duration-200 ease-spring ' +
  'hover:-translate-y-1 active:translate-y-0.5 active:scale-[0.97] ' +
  'disabled:pointer-events-none disabled:opacity-55';

/**
 * The raised, tactile primary action (plan.md §4.4): a glossy flowing-gradient
 * surface with a top highlight, layered shadows, and an accent glow that lifts
 * on hover and presses in on click. `secondary` is a glass equivalent;
 * `ghost` is a quiet text button.
 */
export function GradientButton({
  variant = 'primary',
  size = 'md',
  accent,
  isLoading = false,
  leftIcon,
  className,
  style,
  disabled,
  children,
  ...rest
}: GradientButtonProps) {
  const isPrimary = variant === 'primary';

  return (
    <button
      type="button"
      disabled={disabled ?? isLoading}
      aria-busy={isLoading}
      style={{ ...(accent ? accentVars(accent) : undefined), ...style }}
      className={cn(
        BASE,
        SIZES[size],
        variant === 'primary' && [
          'btn-3d overflow-hidden text-white',
          'bg-[length:220%_auto] bg-[linear-gradient(110deg,var(--accent-from),var(--accent-to),var(--accent-from))]',
          'motion-safe:animate-gradient-flow',
        ],
        variant === 'secondary' && 'btn-3d-soft glass-strong text-fg',
        variant === 'ghost' &&
          'rounded-2xl text-fg-muted hover:bg-[var(--glass-fill)] hover:text-fg active:scale-100',
        className,
      )}
      {...rest}
    >
      {/* Glossy top sheen for the primary variant. */}
      {isPrimary && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-1/2 rounded-t-[inherit] bg-gradient-to-b from-white/30 to-transparent"
        />
      )}
      {isLoading ? <Spinner size={16} className="text-current" /> : leftIcon}
      {children}
    </button>
  );
}
