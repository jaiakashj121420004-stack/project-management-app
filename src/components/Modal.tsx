import { useEffect, useId, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { modalPop } from '@/lib/motion';
import { accentVars, type AccentName } from '@/lib/accents';
import { useFocusTrap } from '@/hooks/useFocusTrap';
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
  const headingId = useId();
  const descriptionId = useId();
  // Trap + restore focus and handle Esc while the dialog is open.
  const dialogRef = useFocusTrap<HTMLDivElement>(open, { onEscape: onClose });

  // Lock body scroll while open (Esc is handled by the focus trap).
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
          <motion.div
            className="absolute inset-0 bg-black/50 backdrop-blur-xl"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            tabIndex={-1}
            aria-label={title ? undefined : 'Dialog'}
            aria-labelledby={title ? headingId : undefined}
            aria-describedby={description ? descriptionId : undefined}
            variants={modalPop}
            initial="hidden"
            animate="visible"
            exit="exit"
            style={accent ? accentVars(accent) : undefined}
            className={cn(
              'glass-strong relative z-10 w-full max-w-lg rounded-2xl p-6 sm:p-7 outline-none',
              className,
            )}
          >
            {(title || description) && (
              <header className="mb-5 pr-10">
                {title && (
                  <h2 id={headingId} className="text-title font-display font-semibold text-fg">
                    {title}
                  </h2>
                )}
                {description && (
                  <p id={descriptionId} className="mt-1 text-sm text-fg-muted">
                    {description}
                  </p>
                )}
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
