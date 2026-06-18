import { cn } from '@/lib/cn';

/** The Aurora wordmark — a glowing gradient orb (with a rotating halo) plus
 *  animated gradient text. */
export function Brand({ collapsed = false, className }: { collapsed?: boolean; className?: string }) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <span
        aria-hidden
        className="relative grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-[length:200%_auto] bg-[linear-gradient(120deg,var(--accent-from),var(--accent-to),var(--accent-from))] shadow-[0_8px_22px_-6px_var(--accent-glow)] motion-safe:animate-gradient-flow"
      >
        <span className="pointer-events-none absolute -inset-1 rounded-[18px] opacity-60 blur-md [background:conic-gradient(from_0deg,var(--accent-from),var(--accent-to),var(--accent-from))] motion-safe:animate-spin-slow" />
        <span className="relative h-3 w-3 rounded-full bg-white/90 shadow-[0_0_14px_3px_rgba(255,255,255,0.75)]" />
      </span>
      {!collapsed && (
        <span className="gradient-text font-display text-xl font-bold tracking-tight">Aurora</span>
      )}
    </div>
  );
}
