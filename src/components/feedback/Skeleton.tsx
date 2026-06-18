import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

/** Shimmering placeholder for loading content. */
export function Skeleton({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl bg-[var(--glass-fill)]',
        'after:absolute after:inset-0 after:-translate-x-full',
        'after:bg-gradient-to-r after:from-transparent after:via-white/15 after:to-transparent',
        'motion-safe:after:animate-shimmer',
        className,
      )}
      {...rest}
    />
  );
}
