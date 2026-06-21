import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { GradientButton } from '@/components/buttons/GradientButton';
import { cn } from '@/lib/cn';
import type { AccentName } from '@/lib/accents';

type Variant = 'primary' | 'secondary' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

interface MarketingButtonProps {
  /** Internal route to navigate to (react-router). */
  to: string;
  variant?: Variant;
  size?: Size;
  accent?: AccentName;
  leftIcon?: ReactNode;
  /** Stretch the link + button to fill the container (e.g. inside a card). */
  fullWidth?: boolean;
  className?: string;
  children: ReactNode;
}

/**
 * `GradientButton` renders a `<button>`, so for marketing CTAs that navigate we
 * wrap it in a router `<Link>`. The link is the focusable element; the button
 * is presentational only (tabIndex -1) to avoid a double tab stop. This keeps
 * the exact tactile button look while behaving like a real link. `fullWidth`
 * stretches both the anchor and the button so it can fill a card column.
 */
export function MarketingButton({
  to,
  variant = 'primary',
  size = 'lg',
  accent,
  leftIcon,
  fullWidth = false,
  className,
  children,
}: MarketingButtonProps) {
  return (
    <Link
      to={to}
      className={cn(
        'inline-flex rounded-2xl focus:outline-none focus-visible:outline-none',
        fullWidth && 'w-full',
      )}
    >
      <GradientButton
        tabIndex={-1}
        variant={variant}
        size={size}
        accent={accent}
        leftIcon={leftIcon}
        className={cn(fullWidth && 'w-full', className)}
      >
        {children}
      </GradientButton>
    </Link>
  );
}
