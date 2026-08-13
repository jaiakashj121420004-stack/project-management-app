import { useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  CalendarDays,
  Command,
  LayoutGrid,
  Palette,
  Sparkles,
  Sun,
  type LucideIcon,
} from 'lucide-react';
import { GradientButton } from '@/components/buttons/GradientButton';
import { cn } from '@/lib/cn';
import { springs } from '@/lib/motion';

const STORAGE_KEY = 'aurora-onboarding-seen';

interface Slide {
  icon: LucideIcon;
  title: string;
  body: string;
}

const SLIDES: Slide[] = [
  {
    icon: Sparkles,
    title: 'Welcome to Aurora',
    body: 'Boards, to-dos, notes, and a calendar that ties them all together — built to feel as good on your phone as it does on your desktop.',
  },
  {
    icon: Sun,
    title: 'Start at Today',
    body: "Today is your daily glance: what's overdue, what's due soon, and today's to-do lists — all in one place.",
  },
  {
    icon: LayoutGrid,
    title: 'Boards & to-dos',
    body: 'Boards hold your projects and Kanban cards. To-Do is a separate, personal daily planner — with priorities and repeat schedules.',
  },
  {
    icon: CalendarDays,
    title: 'The Calendar sees everything',
    body: 'Cards, to-do lists, and project milestones all show up here. Tap a day to see details or add something new right from the calendar.',
  },
  {
    icon: Command,
    title: 'Search anything, anytime',
    body: 'Press ⌘K (or Ctrl+K) — or tap the search bar — to jump straight to any project, card, or note.',
  },
  {
    icon: Palette,
    title: 'Make it yours',
    body: 'Every icon shows its name on hover (or a long press on mobile). Visit Settings any time to pick a font pairing, or your own colors on Pro.',
  },
];

export function hasSeenOnboarding(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return true; // fail closed: never nag if storage is unavailable
  }
}

function markOnboardingSeen(): void {
  try {
    localStorage.setItem(STORAGE_KEY, '1');
  } catch {
    // ignore — worst case the tour shows again next visit
  }
}

/**
 * A short, first-run product tour (per device, like the theme preference) —
 * shown once, dismissible at any point. Deliberately a slide carousel rather
 * than a live element-spotlight: far safer to get right across every screen
 * size than measuring and cutting out real DOM elements.
 */
export function OnboardingTour({ onDone }: { onDone: () => void }) {
  const [index, setIndex] = useState(0);
  // index is always kept within [0, SLIDES.length - 1] by the Next/Skip
  // handlers below, so this index access is always in bounds — the
  // non-null assertion is safe (noUncheckedIndexedAccess can't know that).
  const slide = SLIDES[index]!;
  const isLast = index === SLIDES.length - 1;

  function finish() {
    markOnboardingSeen();
    onDone();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Welcome tour"
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={springs.smooth}
        className="glass-strong w-full max-w-sm rounded-3xl border border-[var(--glass-border)] p-6 text-center shadow-[var(--glass-shadow)]"
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={index}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={springs.snappy}
          >
            <span className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-[linear-gradient(135deg,var(--accent-from),var(--accent-to))] text-[var(--accent-fg)] shadow-[0_10px_30px_-10px_var(--accent-glow)]">
              <slide.icon size={26} />
            </span>
            <h2 className="font-display text-title font-bold text-fg">{slide.title}</h2>
            <p className="mt-2 text-sm text-fg-muted">{slide.body}</p>
          </motion.div>
        </AnimatePresence>

        <div className="mt-6 flex items-center justify-center gap-1.5">
          {SLIDES.map((_, i) => (
            <Dot key={i} active={i === index} />
          ))}
        </div>

        <div className="mt-6 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={finish}
            className="text-sm font-medium text-fg-muted transition-colors hover:text-fg"
          >
            Skip
          </button>
          <GradientButton
            size="sm"
            onClick={() => (isLast ? finish() : setIndex((i) => i + 1))}
          >
            {isLast ? "Let's go" : 'Next'}
          </GradientButton>
        </div>
      </motion.div>
    </div>
  );
}

function Dot({ active }: { active: boolean }): ReactNode {
  return (
    <span
      className={cn(
        'h-1.5 rounded-full transition-all',
        active ? 'w-5 bg-[var(--accent-from)]' : 'w-1.5 bg-[var(--glass-border)]',
      )}
    />
  );
}
