import { useEffect } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { RefreshCw, Sparkles, X } from 'lucide-react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { GradientButton } from '@/components/buttons/GradientButton';
import { springs } from '@/lib/motion';

/**
 * Surfaces service-worker lifecycle to the user (Phase 9):
 *  - `offlineReady` — a brief "ready to work offline" confirmation.
 *  - `needRefresh`  — a new version is precached; offer a one-tap reload.
 *
 * We use registerType: 'prompt' (vite.config) so updates never reload the app
 * out from under the user mid-edit — they choose when to apply.
 */
export function PWAReloadPrompt() {
  const reduceMotion = useReducedMotion();
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  // Auto-dismiss the "offline ready" confirmation; the update prompt stays until
  // the user acts on it.
  useEffect(() => {
    if (!offlineReady) return;
    const timer = setTimeout(() => setOfflineReady(false), 5000);
    return () => clearTimeout(timer);
  }, [offlineReady, setOfflineReady]);

  const show = offlineReady || needRefresh;
  const close = () => {
    setOfflineReady(false);
    setNeedRefresh(false);
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          role="status"
          aria-live="polite"
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 24 }}
          transition={springs.smooth}
          className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] z-50 flex justify-center px-3 md:bottom-[calc(env(safe-area-inset-bottom)+1rem)]"
        >
          <div className="glass flex max-w-sm items-center gap-3 rounded-2xl border border-[var(--glass-border)] px-4 py-3 shadow-xl">
            {needRefresh ? (
              <>
                <Sparkles size={18} className="shrink-0 text-[color:var(--accent-from)]" aria-hidden />
                <span className="text-sm text-fg">A new version of Aurora is available.</span>
                <GradientButton
                  size="sm"
                  leftIcon={<RefreshCw size={14} />}
                  onClick={() => void updateServiceWorker(true)}
                >
                  Reload
                </GradientButton>
              </>
            ) : (
              <>
                <Sparkles size={18} className="shrink-0 text-[color:var(--accent-from)]" aria-hidden />
                <span className="text-sm text-fg">Aurora is ready to work offline.</span>
              </>
            )}
            <button
              type="button"
              onClick={close}
              aria-label="Dismiss"
              className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-fg-subtle transition-colors hover:bg-[var(--glass-fill)] hover:text-fg"
            >
              <X size={15} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
