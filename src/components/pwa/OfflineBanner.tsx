import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { CloudOff } from 'lucide-react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { springs } from '@/lib/motion';

/**
 * A clear "you're offline" indicator (Phase 9). While offline the app still
 * renders the cached, read-only view; this pill tells the user their changes
 * won't be saved until they reconnect. Honors prefers-reduced-motion.
 */
export function OfflineBanner() {
  const online = useOnlineStatus();
  const reduceMotion = useReducedMotion();

  return (
    <AnimatePresence>
      {!online && (
        <motion.div
          role="status"
          aria-live="polite"
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -16 }}
          transition={springs.smooth}
          className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+0.75rem)] z-50 flex justify-center px-3"
        >
          <span className="glass pointer-events-auto inline-flex items-center gap-2 rounded-full border border-warning/30 bg-warning/15 px-4 py-2 text-sm font-medium text-warning shadow-lg">
            <CloudOff size={16} aria-hidden />
            You&apos;re offline — viewing cached data. Changes won&apos;t be saved.
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
