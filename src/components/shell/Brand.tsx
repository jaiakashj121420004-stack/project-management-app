import { cn } from '@/lib/cn';

/** The Aurora wordmark — the Nvexis prism mark plus the wordmark. */
export function Brand({ collapsed = false, className }: { collapsed?: boolean; className?: string }) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <span
        aria-hidden
        className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#181210] shadow-[0_6px_16px_-8px_rgba(0,0,0,0.6)]"
      >
        <img
          src="/brand/nvexis-mark-transparent-800.png"
          alt=""
          className="h-6 w-6 select-none"
          draggable={false}
        />
      </span>
      {!collapsed && (
        <span className="gradient-text font-display text-xl font-bold tracking-tight">Aurora</span>
      )}
    </div>
  );
}
