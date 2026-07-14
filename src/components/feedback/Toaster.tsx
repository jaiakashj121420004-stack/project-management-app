import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { AlertCircle, Check, Info, X } from 'lucide-react';
import { springs } from '@/lib/motion';
import { cn } from '@/lib/cn';
import { subscribe, dismissToast, type Toast, type ToastVariant } from './toast';

/** Per-variant glass styling + icon (single-accent-safe: danger/success/info). */
const VARIANTS: Record<ToastVariant, { className: string; Icon: typeof AlertCircle }> = {
  error: { className: 'border-danger/30 bg-danger/15 text-danger', Icon: AlertCircle },
  success: { className: 'border-success/30 bg-success/15 text-success', Icon: Check },
  info: { className: 'border-info/30 bg-info/15 text-info', Icon: Info },
};

/**
 * Renders the toast stack (bottom-centre, above the mobile bottom-nav). Subscribes
 * to the module-level `toast` store so anything — including the global
 * `MutationCache({ onError })` outside the React tree — can raise a message.
 * Mounted once at the app root. Honors prefers-reduced-motion.
 */
export function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  useEffect(() => subscribe(setToasts), []);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+5rem)] z-[60] flex flex-col items-center gap-2 px-3 md:bottom-[calc(env(safe-area-inset-bottom)+1rem)]">
      <AnimatePresence initial={false}>
        {toasts.map((toast) => (
          <ToastRow key={toast.id} toast={toast} />
        ))}
      </AnimatePresence>
    </div>
  );
}

function ToastRow({ toast }: { toast: Toast }) {
  const reduceMotion = useReducedMotion();
  const { className, Icon } = VARIANTS[toast.variant];

  useEffect(() => {
    const timer = window.setTimeout(() => dismissToast(toast.id), toast.duration);
    return () => window.clearTimeout(timer);
  }, [toast.id, toast.duration]);

  return (
    <motion.div
      layout
      role={toast.variant === 'error' ? 'alert' : 'status'}
      aria-live={toast.variant === 'error' ? 'assertive' : 'polite'}
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.96 }}
      transition={springs.smooth}
      className={cn(
        'glass pointer-events-auto flex w-full max-w-md items-start gap-2.5 rounded-xl border px-4 py-3 text-sm font-medium shadow-lg',
        className,
      )}
    >
      <Icon size={18} aria-hidden className="mt-0.5 shrink-0" />
      <span className="min-w-0 flex-1 break-words text-fg">{toast.message}</span>
      <button
        type="button"
        onClick={() => dismissToast(toast.id)}
        aria-label="Dismiss"
        className="-mr-1 -mt-0.5 shrink-0 rounded-md p-1 text-fg-muted hover:text-fg"
      >
        <X size={15} aria-hidden />
      </button>
    </motion.div>
  );
}
