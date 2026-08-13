import { useState, type ReactNode } from 'react';
import {
  CalendarDays,
  Command,
  Flag,
  HelpCircle,
  MousePointerClick,
  Paintbrush,
  Repeat,
  Smartphone,
} from 'lucide-react';
import { Modal } from '@/components/Modal';
import { Tooltip } from '@/components/Tooltip';

interface Tip {
  icon: ReactNode;
  title: string;
  body: string;
}

const TIPS: Tip[] = [
  {
    icon: <Command size={16} />,
    title: 'Search anything — ⌘K / Ctrl+K',
    body: 'Jump to any project, card, or note from the search bar at the top, on any device.',
  },
  {
    icon: <MousePointerClick size={16} />,
    title: 'Hover any icon to see what it does',
    body: 'Every icon-only button in Aurora shows its name on hover — no guessing.',
  },
  {
    icon: <Smartphone size={16} />,
    title: 'On phones and tablets, press and hold',
    body: 'A long press ("deep press") on an icon reveals the same label hover shows on desktop.',
  },
  {
    icon: <Flag size={16} />,
    title: 'To-do priorities',
    body: 'Tap the flag on a to-do item to set P1, P2, P3… P1 always sorts to the top of its list.',
  },
  {
    icon: <Repeat size={16} />,
    title: 'Repeating to-do lists',
    body: 'Tap the repeat icon on a list to set it to daily, specific weekdays, monthly, or every N weeks — Pro unlocks anything beyond daily.',
  },
  {
    icon: <CalendarDays size={16} />,
    title: 'Calendar shows everything',
    body: "To-do lists and project milestones both show up on the Calendar. Tap a day's chips to see details or add a new to-do list or project right there.",
  },
  {
    icon: <Paintbrush size={16} />,
    title: 'Make it yours in Settings',
    body: 'Pick a font pairing (free) or your own background/text colors (Pro) — the glass and grain always stay the same.',
  },
];

/** A small, always-available "?" entry point covering the app's less-obvious
 *  features — the answer to "how was I supposed to know that?" on any device. */
export function HelpPanel() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Tooltip label="Help & tips" side="bottom">
        <button
          type="button"
          aria-label="Help & tips"
          onClick={() => setOpen(true)}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-fg-muted transition-colors hover:bg-[var(--glass-fill)] hover:text-fg"
        >
          <HelpCircle size={19} />
        </button>
      </Tooltip>

      <Modal open={open} onClose={() => setOpen(false)} title="Tips & shortcuts">
        <ul className="flex flex-col gap-3">
          {TIPS.map((tip) => (
            <li key={tip.title} className="flex items-start gap-3">
              <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[var(--glass-fill)] text-[var(--accent-from)]">
                {tip.icon}
              </span>
              <div>
                <p className="text-sm font-semibold text-fg">{tip.title}</p>
                <p className="text-sm text-fg-muted">{tip.body}</p>
              </div>
            </li>
          ))}
        </ul>
      </Modal>
    </>
  );
}
