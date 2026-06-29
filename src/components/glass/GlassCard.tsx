import { useRef, type ReactNode } from 'react';
import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useSpring,
} from 'framer-motion';
import { cn } from '@/lib/cn';
import { accentVars, type AccentName } from '@/lib/accents';

interface GlassCardProps {
  accent?: AccentName;
  /** Disable the pointer tilt (e.g. for dense lists). */
  flat?: boolean;
  className?: string;
  children?: ReactNode;
  onClick?: () => void;
}

const MAX_TILT = 9; // degrees

/**
 * A glass surface that tilts toward the pointer in 3D (plan.md §4.4): rotateX/
 * rotateY follow the cursor and the drop shadow shifts with the tilt, so the
 * card reads as a physical object under glass. Tilt is disabled for
 * reduced-motion users and when `flat` is set.
 */
export function GlassCard({ accent, flat = false, className, children, onClick }: GlassCardProps) {
  const reducedMotion = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const tiltActive = !flat && !reducedMotion;

  const rotateX = useSpring(useMotionValue(0), { stiffness: 280, damping: 18 });
  const rotateY = useSpring(useMotionValue(0), { stiffness: 280, damping: 18 });

  // Shadow offset tracks the tilt so light feels like it comes from above.
  const shadow = useMotionTemplate`var(--glass-shadow), ${rotateY}px ${rotateX}px 40px -18px var(--accent-glow)`;

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!tiltActive || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width - 0.5;
    const py = (event.clientY - rect.top) / rect.height - 0.5;
    rotateY.set(px * MAX_TILT * 2);
    rotateX.set(-py * MAX_TILT * 2);
  };

  const reset = () => {
    rotateX.set(0);
    rotateY.set(0);
  };

  return (
    <motion.div
      ref={ref}
      onPointerMove={handlePointerMove}
      onPointerLeave={reset}
      onClick={onClick}
      style={{
        ...(accent ? accentVars(accent) : undefined),
        transformPerspective: 900,
        rotateX: tiltActive ? rotateX : 0,
        rotateY: tiltActive ? rotateY : 0,
        boxShadow: tiltActive ? shadow : 'var(--glass-shadow)',
      }}
      whileHover={tiltActive ? { scale: 1.015 } : undefined}
      className={cn(
        'glass rounded-3xl [transform-style:preserve-3d]',
        onClick && 'cursor-pointer',
        className,
      )}
    >
      {children}
    </motion.div>
  );
}
