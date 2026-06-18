import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { modalPop } from '@/lib/motion';
import { accentVars, type AccentName } from '@/lib/accents';
import { cn } from '@/lib/cn';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  accent?: AccentName;
  className?: string;
  children?: ReactNode;
}

/**
 * Glass modal that springs in (centered on desktop, bottom sheet on mobile).
 * Closes on Esc or backdrop click, locks body scroll, and is portaled to body.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  accent,
  className,
  children,
}: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
          <motion.div
            className="absolute inset-0 bg-black/60 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            variants={modalPop}
            initial="hidden"
            animate="visible"
            exit="exit"
            style={accent ? accentVars(accent) : undefined}
            className={cn(
              'glass-strong glass-edge relative z-10 w-full max-w-lg rounded-4xl p-6 sm:p-7',
              className,
            )}
          >
            {(title || description) && (
              <header className="mb-5 pr-10">
                {title && <h2 className="text-title font-display font-semibold text-fg">{title}</h2>}
                {description && <p className="mt-1 text-sm text-fg-muted">{description}</p>}
              </header>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className={cn(
                'absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full',
                'text-fg-muted transition-colors hover:bg-[var(--glass-fill)] hover:text-fg',
              )}
            >
              <X size={18} />
            </button>
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
