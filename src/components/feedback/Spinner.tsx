import { cn } from '@/lib/cn';

/** Accent-tinted ring spinner. Inherits `--accent-*` from its context. */
export function Spinner({ size = 20, className }: { size?: number; className?: string }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={cn('spinner inline-block animate-spin rounded-full', className)}
      style={{
        width: size,
        height: size,
        background: 'conic-gradient(from 0deg, transparent, var(--accent-from), var(--accent-to))',
        WebkitMask: 'radial-gradient(farthest-side, transparent calc(100% - 2.5px), #000 0)',
        mask: 'radial-gradient(farthest-side, transparent calc(100% - 2.5px), #000 0)',
      }}
    />
  );
}
