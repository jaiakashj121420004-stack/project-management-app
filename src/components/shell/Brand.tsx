import { cn } from '@/lib/cn';

/**
 * The Aurora mark — a Fraunces-inspired "A" monogram knocked into an oxblood
 * tile (the product logo; Nvexis is the company, shown only as attribution).
 * Vector, so it stays crisp at any size. The tile uses the theme oxblood
 * (`--ox`) so it stays vivid on both Day parchment and Night ink; the letter is
 * a fixed warm bone. Source of truth for the icon files: public/brand/aurora-*.svg.
 */
export function AuroraMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 120 120"
      className={className}
      role="img"
      aria-label="Aurora"
      style={{ filter: 'drop-shadow(0 6px 16px rgb(0 0 0 / 0.28))' }}
    >
      <rect x="8" y="8" width="104" height="104" rx="26" fill="var(--ox)" />
      <g fill="#F3ECDD">
        <polygon points="60,24 62,24 37,96 25,96" />
        <polygon points="58,24 60,24 101,96 77,96" />
        <rect x="44" y="66.5" width="29" height="8" />
        <rect x="18.5" y="91.5" width="27.5" height="6.5" rx="1.5" />
        <rect x="74" y="91.5" width="30" height="6.5" rx="1.5" />
      </g>
    </svg>
  );
}

/** The Aurora lockup: the A-monogram mark plus the wordmark (single oxblood accent). */
export function Brand({ collapsed = false, className }: { collapsed?: boolean; className?: string }) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <AuroraMark className="h-9 w-9 shrink-0 select-none" />
      {!collapsed && (
        <span className="font-display text-xl font-bold tracking-tight text-ox">Aurora</span>
      )}
    </div>
  );
}
