import { AnimatePresence, motion } from 'framer-motion';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { springs } from '@/lib/motion';
import { cn } from '@/lib/cn';

/** Glass icon button that flips between dark and light, cross-fading the app. */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} theme`}
      title={`Switch to ${isDark ? 'light' : 'dark'} theme`}
      className={cn(
        'glass relative grid h-10 w-10 place-items-center overflow-hidden rounded-2xl',
        'text-fg transition-transform duration-200 ease-spring',
        'hover:-translate-y-0.5 active:translate-y-0 active:scale-95',
        className,
      )}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={theme}
          initial={{ y: 14, opacity: 0, rotate: -30 }}
          animate={{ y: 0, opacity: 1, rotate: 0 }}
          exit={{ y: -14, opacity: 0, rotate: 30 }}
          transition={springs.snappy}
          className="grid place-items-center"
        >
          {isDark ? <Moon size={18} strokeWidth={2.2} /> : <Sun size={19} strokeWidth={2.2} />}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}
