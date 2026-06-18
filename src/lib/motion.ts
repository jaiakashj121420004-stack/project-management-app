import type { Transition, Variants } from 'framer-motion';

/** Shared spring presets so motion feels consistent across the app. */
export const springs = {
  /** Snappy, for hover/press feedback. */
  snappy: { type: 'spring', stiffness: 520, damping: 30, mass: 0.7 },
  /** Smooth, for layout and panel transitions. */
  smooth: { type: 'spring', stiffness: 280, damping: 30 },
  /** Gentle, for large entrances. */
  gentle: { type: 'spring', stiffness: 180, damping: 26 },
} satisfies Record<string, Transition>;

/** Fade + lift entrance, used by the Reveal wrapper and modals. */
export const reveal: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: springs.gentle },
};

/** Stagger children on mount. */
export const stagger: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
};

/** Modal/sheet pop. */
export const modalPop: Variants = {
  hidden: { opacity: 0, scale: 0.94, y: 12 },
  visible: { opacity: 1, scale: 1, y: 0, transition: springs.smooth },
  exit: { opacity: 0, scale: 0.96, y: 8, transition: { duration: 0.15 } },
};
