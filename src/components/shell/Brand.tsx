import { cn } from '@/lib/cn';

/**
 * The Jotspring mark — a serif "J" monogram with a small spark knocked into an oxblood
 * tile (the product logo; Nvexis is the company, shown only as attribution).
 * Vector, so it stays crisp at any size. The tile uses the theme oxblood
 * (`--ox`) so it stays vivid on both Day parchment and Night ink; the letter is
 * a fixed warm bone. Source of truth for the icon files: public/brand/jotspring-*.svg.
 */
export function JotspringMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 120 120"
      className={className}
      role="img"
      aria-label="Jotspring"
      style={{ filter: 'drop-shadow(0 6px 16px rgb(0 0 0 / 0.28))' }}
    >
      <rect x="8" y="8" width="104" height="104" rx="26" fill="var(--ox)" />
      <g fill="#F3ECDD">
        <rect x="38" y="24" width="46" height="7" rx="1.5" />
        <path d="M58 31h12v43c0 16-8 24-21 24-9 0-15-5-16-12 0-4 3-7 7-7s7 3 7 7c0 2 1 3 2 3 6 0 9-5 9-15z" />
        <path d="M93 31l2.4 7.6L103 41l-7.6 2.4L93 51l-2.4-7.6L83 41l7.6-2.4z" />
      </g>
    </svg>
  );
}

/** The Jotspring lockup: the J-monogram mark plus the wordmark (single oxblood accent). */
export function Brand({ collapsed = false, className }: { collapsed?: boolean; className?: string }) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <JotspringMark className="h-9 w-9 shrink-0 select-none" />
      {!collapsed && (
        <span className="font-display text-xl font-bold tracking-tight text-ox">Jotspring</span>
      )}
    </div>
  );
}
