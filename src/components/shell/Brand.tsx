import { cn } from '@/lib/cn';

/**
 * The Jotspring mark — a serif "J" monogram (Fraunces Black, outlined) on an oxblood
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
      <path fill="#F7EBDD" d="M81.8 78.4Q81.8 85.0 75.5 89.0Q69.3 93.0 58.2 93.0Q47.6 93.0 41.7 89.1Q35.7 85.3 35.7 78.5Q35.7 73.8 38.3 71.0Q40.9 68.1 45.3 68.1Q49.1 68.1 51.6 70.8Q54.1 73.5 54.1 78.3V82.5Q54.1 84.9 55.3 86.2Q56.5 87.5 58.9 87.5Q61.2 87.5 62.6 86.2Q63.9 84.9 63.9 82.5Q63.9 80.2 62.8 78.1Q61.7 76.0 60.2 73.5Q58.8 71.1 57.7 67.8Q56.6 64.6 56.6 60.0V37.0Q56.6 35.8 56.0 35.1Q55.5 34.3 54.3 34.0L51.5 33.4Q50.1 33.1 49.5 32.3Q48.8 31.6 48.8 30.0Q48.8 28.6 49.8 27.8Q50.7 27.0 52.7 27.0H80.4Q82.4 27.0 83.3 27.8Q84.3 28.6 84.3 30.0Q84.3 32.5 81.9 33.4L80.2 34.0Q79.1 34.5 78.5 35.2Q77.9 35.9 77.9 37.0V58.7Q77.9 62.3 78.5 64.9Q79.1 67.5 79.8 69.5Q80.6 71.6 81.2 73.7Q81.8 75.8 81.8 78.4Z" />
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
