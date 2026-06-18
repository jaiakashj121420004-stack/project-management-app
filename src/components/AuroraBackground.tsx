import { useEffect } from 'react';
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from 'framer-motion';

/**
 * The living cosmic backdrop (plan.md §4.3, "Cosmic Bento"): drifting nebula
 * clouds, sweeping aurora ribbons, a twinkling starfield, and fine film grain.
 * Three depth planes parallax toward the pointer by different amounts so the
 * sky feels three-dimensional. All pointer motion is disabled under
 * prefers-reduced-motion; the slow CSS drifts calm themselves via the global
 * reduced-motion rule. Works in both the deep-space dark and dawn light themes.
 */
export function AuroraBackground() {
  const reducedMotion = useReducedMotion();

  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const smoothX = useSpring(pointerX, { stiffness: 50, damping: 22, mass: 0.7 });
  const smoothY = useSpring(pointerY, { stiffness: 50, damping: 22, mass: 0.7 });

  const farX = useTransform(smoothX, [-0.5, 0.5], [10, -10]);
  const farY = useTransform(smoothY, [-0.5, 0.5], [10, -10]);
  const midX = useTransform(smoothX, [-0.5, 0.5], [-22, 22]);
  const midY = useTransform(smoothY, [-0.5, 0.5], [-22, 22]);
  const nearX = useTransform(smoothX, [-0.5, 0.5], [-40, 40]);
  const nearY = useTransform(smoothY, [-0.5, 0.5], [-40, 40]);

  useEffect(() => {
    if (reducedMotion) return;
    const onPointerMove = (event: PointerEvent) => {
      pointerX.set(event.clientX / window.innerWidth - 0.5);
      pointerY.set(event.clientY / window.innerHeight - 0.5);
    };
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    return () => window.removeEventListener('pointermove', onPointerMove);
  }, [pointerX, pointerY, reducedMotion]);

  const layer = (x: typeof farX, y: typeof farY) => (reducedMotion ? undefined : { x, y });

  return (
    <div className="cosmos" aria-hidden>
      <motion.div className="absolute inset-0" style={layer(farX, farY)}>
        <div className="stars stars--far" />
        <div className="neb neb--4" />
      </motion.div>

      <motion.div className="absolute inset-0" style={layer(midX, midY)}>
        <div className="ribbon ribbon--1" />
        <div className="ribbon ribbon--2" />
        <div className="neb neb--2" />
        <div className="neb neb--3" />
      </motion.div>

      <motion.div className="absolute inset-0" style={layer(nearX, nearY)}>
        <div className="neb neb--1" />
        <div className="stars" />
      </motion.div>

      <div className="grain" />
    </div>
  );
}
