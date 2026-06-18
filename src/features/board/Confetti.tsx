import { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, useReducedMotion } from 'framer-motion';

/**
 * A celebratory confetti burst (plan.md §4.4) — fired when a card lands in a
 * "Done"-type column. The inner <Burst> is keyed by `fireKey`, so a new non-zero
 * value remounts it with a fresh set of pieces; it removes itself once the
 * animation finishes. Fully skipped under prefers-reduced-motion.
 */

const COLORS = ['#7C3AED', '#06B6D4', '#EC4899', '#F59E0B', '#10B981', '#A855F7'];
const PIECE_COUNT = 90;

interface Piece {
  id: number;
  x: number;
  y: number;
  rotate: number;
  color: string;
  scale: number;
}

function makeBurst(): Piece[] {
  return Array.from({ length: PIECE_COUNT }, (_, i) => {
    const angle = Math.random() * Math.PI * 2;
    const distance = 120 + Math.random() * 260;
    return {
      id: i,
      x: Math.cos(angle) * distance,
      // Bias the initial burst upward so it reads as a "pop".
      y: Math.sin(angle) * distance - 60,
      rotate: Math.random() * 720 - 360,
      color: COLORS[i % COLORS.length] ?? '#7C3AED',
      scale: 0.6 + Math.random() * 1,
    };
  });
}

export function Confetti({ fireKey }: { fireKey: number }) {
  const reducedMotion = useReducedMotion();
  if (reducedMotion || fireKey === 0) return null;
  return <Burst key={fireKey} />;
}

function Burst() {
  // Lazy initializer → the burst is generated exactly once per mount.
  const [pieces] = useState(makeBurst);
  const [done, setDone] = useState(false);
  if (done) return null;

  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[60] grid place-items-center overflow-hidden">
      {pieces.map((piece, index) => (
        <motion.span
          key={piece.id}
          initial={{ x: 0, y: 0, opacity: 1, scale: piece.scale, rotate: 0 }}
          animate={{
            x: [0, piece.x * 0.6, piece.x],
            y: [0, piece.y, piece.y + 320],
            opacity: [1, 1, 0],
            rotate: [0, piece.rotate * 0.6, piece.rotate],
          }}
          transition={{ duration: 1.3, ease: 'easeOut', times: [0, 0.35, 1] }}
          onAnimationComplete={index === 0 ? () => setDone(true) : undefined}
          style={{
            position: 'absolute',
            width: 9,
            height: 14,
            borderRadius: 3,
            backgroundColor: piece.color,
          }}
        />
      ))}
    </div>,
    document.body,
  );
}
