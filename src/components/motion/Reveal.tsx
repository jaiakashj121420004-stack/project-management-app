import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { reveal } from '@/lib/motion';
import { cn } from '@/lib/cn';

/**
 * Consistent fade + lift entrance. Drop around any block to reveal it on mount;
 * place inside a `stagger` parent to cascade. Reduced motion is honored by the
 * app-level `<MotionConfig reducedMotion="user">` (main.tsx), which drops the
 * transform/lift and keeps only the opacity fade — the CSS guard alone cannot
 * stop Framer's JS-driven transforms.
 */
export function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      variants={reveal}
      initial="hidden"
      animate="visible"
      transition={{ delay }}
      className={cn(className)}
    >
      {children}
    </motion.div>
  );
}
