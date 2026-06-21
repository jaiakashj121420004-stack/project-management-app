import { motion, useReducedMotion } from 'framer-motion';
import { GlassPanel } from '@/components/glass/GlassPanel';
import { accentVars } from '@/lib/accents';
import { HERO_BOARD, HERO_COLUMN_ACCENT } from '../sampleData';
import { FauxCard } from './FauxCard';

/**
 * The animated in-app preview headlining the hero: three accented glass columns
 * matching the real board, with cards that reveal in a stagger and then breathe
 * with a slow, pointer-independent float. All motion is opt-out via
 * prefers-reduced-motion (the cards simply sit still).
 */
export function FauxBoard() {
  const reducedMotion = useReducedMotion();

  return (
    <div
      aria-hidden
      className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4"
    >
      {HERO_BOARD.map((column, columnIndex) => (
        <GlassPanel
          key={column.id}
          strong
          glow
          accent={HERO_COLUMN_ACCENT[columnIndex]}
          className="flex flex-col gap-3 p-3"
        >
          <header className="flex items-center gap-2 px-1">
            <span
              className="h-2.5 w-2.5 rounded-full bg-[linear-gradient(135deg,var(--accent-from),var(--accent-to))]"
              style={accentVars(HERO_COLUMN_ACCENT[columnIndex]!)}
            />
            <h3 className="font-display text-sm font-semibold text-fg">{column.name}</h3>
            <span className="ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-[var(--glass-fill)] px-1.5 text-[0.7rem] font-medium text-fg-muted">
              {column.cards.length}
            </span>
          </header>

          <div className="flex flex-col gap-2.5">
            {column.cards.map((card, cardIndex) => {
              const order = columnIndex + cardIndex;
              return (
                <motion.div
                  key={card.id}
                  style={accentVars(HERO_COLUMN_ACCENT[columnIndex]!)}
                  initial={reducedMotion ? false : { opacity: 0, y: 18, scale: 0.96 }}
                  whileInView={reducedMotion ? undefined : { opacity: 1, y: 0, scale: 1 }}
                  viewport={{ once: true, margin: '-60px' }}
                  transition={{ delay: 0.12 + order * 0.08, type: 'spring', stiffness: 180, damping: 22 }}
                >
                  <motion.div
                    animate={
                      reducedMotion
                        ? undefined
                        : { y: [0, -6, 0] }
                    }
                    transition={
                      reducedMotion
                        ? undefined
                        : { duration: 4.5 + order * 0.4, repeat: Infinity, ease: 'easeInOut', delay: order * 0.25 }
                    }
                  >
                    <FauxCard card={card} />
                  </motion.div>
                </motion.div>
              );
            })}
          </div>
        </GlassPanel>
      ))}
    </div>
  );
}
