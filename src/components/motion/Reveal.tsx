import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { reveal } from '@/lib/motion';
import { cn } from '@/lib/cn';

/**
 * Consistent fade + lift entrance. Drop around any block to reveal it on mount;
 * place inside a `stagger` parent to cascade. Respects reduced motion via the
 * global CSS guard.
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
