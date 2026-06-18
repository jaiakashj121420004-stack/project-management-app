import { useEffect } from 'react';
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from 'framer-motion';

/**
 * The living aurora backdrop (plan.md §4.3): softly blurred gradient blobs that
 * drift continuously (CSS keyframes) and parallax toward the pointer in two
 * depth layers. All pointer motion is disabled under prefers-reduced-motion.
 */
export function AuroraBackground() {
  const reducedMotion = useReducedMotion();

  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const smoothX = useSpring(pointerX, { stiffness: 60, damping: 20, mass: 0.6 });
  const smoothY = useSpring(pointerY, { stiffness: 60, damping: 20, mass: 0.6 });

  // Two layers move by different amounts → parallax depth.
  const nearX = useTransform(smoothX, [-0.5, 0.5], [-30, 30]);
  const nearY = useTransform(smoothY, [-0.5, 0.5], [-30, 30]);
  const farX = useTransform(smoothX, [-0.5, 0.5], [16, -16]);
  const farY = useTransform(smoothY, [-0.5, 0.5], [16, -16]);

  useEffect(() => {
    if (reducedMotion) return;
    const onPointerMove = (event: PointerEvent) => {
      pointerX.set(event.clientX / window.innerWidth - 0.5);
      pointerY.set(event.clientY / window.innerHeight - 0.5);
    };
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    return () => window.removeEventListener('pointermove', onPointerMove);
  }, [pointerX, pointerY, reducedMotion]);

  return (
    <div className="aurora-field" aria-hidden>
      <motion.div className="absolute inset-0" style={reducedMotion ? undefined : { x: nearX, y: nearY }}>
        <div className="aurora-blob aurora-blob--1" />
        <div className="aurora-blob aurora-blob--3" />
      </motion.div>
      <motion.div className="absolute inset-0" style={reducedMotion ? undefined : { x: farX, y: farY }}>
        <div className="aurora-blob aurora-blob--2" />
      </motion.div>
      <div className="aurora-grain" />
    </div>
  );
}
