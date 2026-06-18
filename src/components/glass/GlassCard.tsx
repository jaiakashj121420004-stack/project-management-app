import { useRef, useState, type ReactNode } from 'react';
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

const MAX_TILT = 10; // degrees

/**
 * A glass surface that tilts toward the pointer in 3D (plan.md §4.4) and catches
 * a soft accent "spotlight" that tracks the cursor, so the card reads as a
 * physical object floating under glass. The drop shadow shifts with the tilt and
 * deepens on hover (z-plane lift). Tilt + spotlight are disabled for
 * reduced-motion users and when `flat` is set.
 */
export function GlassCard({ accent, flat = false, className, children, onClick }: GlassCardProps) {
  const reducedMotion = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState(false);
  const tiltActive = !flat && !reducedMotion;

  const rotateX = useSpring(useMotionValue(0), { stiffness: 280, damping: 18 });
  const rotateY = useSpring(useMotionValue(0), { stiffness: 280, damping: 18 });

  const glareX = useMotionValue(50);
  const glareY = useMotionValue(50);
  const glare = useMotionTemplate`radial-gradient(220px circle at ${glareX}% ${glareY}%, color-mix(in srgb, var(--accent-from) 22%, transparent), transparent 62%)`;

  const lift = hovered ? '52px -22px' : '40px -18px';
  const shadow = useMotionTemplate`var(--glass-shadow), ${rotateY}px ${rotateX}px ${lift} var(--accent-glow)`;

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!tiltActive || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width - 0.5;
    const py = (event.clientY - rect.top) / rect.height - 0.5;
    rotateY.set(px * MAX_TILT * 2);
    rotateX.set(-py * MAX_TILT * 2);
    glareX.set((px + 0.5) * 100);
    glareY.set((py + 0.5) * 100);
  };

  const reset = () => {
    rotateX.set(0);
    rotateY.set(0);
    setHovered(false);
  };

  return (
    <motion.div
      ref={ref}
      onPointerMove={handlePointerMove}
      onPointerEnter={() => tiltActive && setHovered(true)}
      onPointerLeave={reset}
      onClick={onClick}
      style={{
        ...(accent ? accentVars(accent) : undefined),
        transformPerspective: 900,
        rotateX: tiltActive ? rotateX : 0,
        rotateY: tiltActive ? rotateY : 0,
        boxShadow: tiltActive ? shadow : 'var(--glass-shadow)',
      }}
      whileHover={tiltActive ? { scale: 1.02 } : undefined}
      className={cn(
        'glass relative rounded-3xl [transform-style:preserve-3d]',
        onClick && 'cursor-pointer',
        className,
      )}
    >
      {tiltActive && (
        <motion.span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[inherit] transition-opacity duration-300"
          style={{ background: glare, opacity: hovered ? 1 : 0 }}
        />
      )}
      {children}
    </motion.div>
  );
}
